import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { GenerateCliOptions, PackageManager } from '$types';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';
import { getGenerateOptions } from '$utils/options.ts';

/**
 * Creates a temporary directory containing firebase.json and .firebaserc
 * so the Firebase CLI recognizes the project as initialized without
 * modifying the user's actual project directory. The caller is responsible
 * for cleaning up the temp directory.
 * @param projectId - The Firebase project ID
 * @param dataconnectDir - Absolute path to the real dataconnect directory
 * @returns Path to the temporary project directory
 */
const createTempProject = async (projectId: string, dataconnectDir: string): Promise<string> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'firestack-'));

  const firebaseJson = {
    dataconnect: {
      source: dataconnectDir,
    },
  };
  await writeFile(
    join(tmpDir, 'firebase.json'),
    `${JSON.stringify(firebaseJson, null, 2)}
`
  );

  const firebaserc = {
    projects: {
      default: projectId,
    },
  };
  await writeFile(
    join(tmpDir, '.firebaserc'),
    `${JSON.stringify(firebaserc, null, 2)}
`
  );

  logger.debug(`Created temp project at ${tmpDir}`);

  return tmpDir;
};

/**
 * Checks whether any connector in the dataconnect directory has a `generate`
 * section configured in its connector.yaml. If none do, runs
 * `firebase init dataconnect:sdk` to auto-configure SDK generation.
 * @param workingDir - The directory to run firebase commands from (temp dir)
 * @param projectId - The Firebase project ID
 * @param dataconnectDir - Absolute path to the real dataconnect directory
 * @param packageManager - The package manager
 */
const ensureSdkGenerationConfigured = async (
  workingDir: string,
  projectId: string,
  dataconnectDir: string,
  packageManager: PackageManager
): Promise<void> => {
  const connectorYamlPaths = await findConnectorYamlFiles(dataconnectDir);

  let hasGenerateConfig = false;
  for (const yamlPath of connectorYamlPaths) {
    try {
      const content = await readFile(yamlPath, 'utf-8');
      if (/^generate:/m.test(content)) {
        hasGenerateConfig = true;
        break;
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (!hasGenerateConfig) {
    logger.info(chalk.cyan('⚙️  Configuring SDK generation...'));
    const result = await executeCommand('firebase', {
      args: ['init', 'dataconnect:sdk', '--project', projectId],
      cwd: workingDir,
      packageManager,
    });

    if (!result.success) {
      logger.warn(
        chalk.yellow(
          '⚠ SDK generation configuration may have completed partially. SDK errors are expected if the schema has validation issues.'
        )
      );
    }
  }
};

/**
 * Recursively finds all connector.yaml files within a directory.
 * @param dir - The directory to search
 * @returns Array of absolute paths to connector.yaml files
 */
const findConnectorYamlFiles = async (dir: string): Promise<string[]> => {
  const results: string[] = [];
  const { readdir } = await import('node:fs/promises');

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await findConnectorYamlFiles(fullPath);
      results.push(...subResults);
    } else if (entry.name === 'connector.yaml') {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Main action for the generate command.
 * Generates Data Connect SDKs from local schema files.
 * @param cliOptions - The options provided via CLI
 */
export const generateAction = async (cliOptions: GenerateCliOptions) => {
  const generateOptions = await getGenerateOptions(cliOptions);

  if (!generateOptions.projectId) {
    logger.error(
      chalk.red(
        'Project ID not found. Please provide it using --projectId option or in firestack config.'
      )
    );
    exit(1);
  }

  const projectRoot = cwd();
  const dataconnectDir = join(projectRoot, generateOptions.dataconnectDirectory);

  if (!(await exists(dataconnectDir))) {
    logger.error(
      chalk.red(
        `Data Connect directory not found at ${chalk.bold(generateOptions.dataconnectDirectory)}.`
      )
    );
    exit(1);
  }

  const isWatchMode = generateOptions.watch;

  logger.info(
    chalk.cyan(`🔗 ${isWatchMode ? 'Watching and generating' : 'Generating'} Data Connect SDKs...`)
  );

  const commandArgs = ['dataconnect:sdk:generate'];

  if (isWatchMode) {
    commandArgs.push('--watch');
  }

  if (generateOptions.projectId) {
    commandArgs.push('--project', generateOptions.projectId);
  }

  logger.debug(`Running: firebase ${commandArgs.join(' ')}`);

  // Create a temp project directory with firebase.json + .firebaserc so the
  // Firebase CLI skips init without modifying the user's actual project dir.
  const tmpDir = await createTempProject(generateOptions.projectId, dataconnectDir);

  try {
    // Ensure at least one connector has SDK generation configured.
    // If not, run firebase init dataconnect:sdk to auto-configure.
    await ensureSdkGenerationConfigured(
      tmpDir,
      generateOptions.projectId,
      dataconnectDir,
      generateOptions.packageManager
    );

    const result = await executeCommand('firebase', {
      args: commandArgs,
      cwd: tmpDir,
      packageManager: generateOptions.packageManager,
    });

    if (!result.success) {
      if (isWatchMode) {
        logger.error(chalk.red('❌ Data Connect SDK watch ended unexpectedly.'));
      } else {
        logger.error(chalk.red('❌ Failed to generate Data Connect SDKs.'));
        if (result.stderr) {
          logger.error(result.stderr);
        }
        if (result.stdout) {
          logger.error(result.stdout);
        }
        logger.info(chalk.cyan('💡 Tip: Run with --verbose to see the full Firebase CLI output.'));
      }
      return;
    }

    if (!isWatchMode) {
      logger.info(chalk.bold.green('✅ Data Connect SDKs generated successfully.'));
    }
  } finally {
    if (generateOptions.debug) {
      logger.info(chalk.cyan(`🔍 Debug mode: temp project kept at ${tmpDir}`));
    } else {
      await rm(tmpDir, { recursive: true, force: true });
      logger.debug(`Cleaned up ${tmpDir}`);
    }
  }
};

/**
 * The generate command definition.
 */
export const generateCommand = new Command('generate')
  .description('Generates Data Connect SDKs from local schema files.')
  .option('--mode <mode>', 'The mode to use for generation.')
  .option('--projectId <projectId>', 'The Firebase project ID.')
  .option('--verbose', 'Enable verbose logging (shows full Firebase CLI output).')
  .option('--debug', 'Enable debug mode (keeps temp project directory for inspection).')
  .option('--silent', 'Disable logging (only errors are shown).')
  .option('--watch', 'Watch Data Connect schema files and regenerate SDKs on changes.')
  .option(
    '--packageManager <packageManager>',
    'The package manager to use (npm, yarn, pnpm, bun, global).'
  )
  .option(
    '--dataconnectDirectory <dataconnectDirectory>',
    'The directory containing the Data Connect configuration.'
  )
  .action(generateAction);
