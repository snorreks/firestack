import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import { buildFunction } from '$utils/build_utils.js';

/**
 * Reads the content of a text file.
 * @param path - The path to the file.
 * @returns A promise that resolves to the file's content as a string.
 */
async function _readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Writes content to a text file.
 * @param path - The path to the file.
 * @param contents - The content to write.
 * @returns A promise that resolves when the file is written.
 */
async function _writeTextFile(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, 'utf-8');
}

/**
 * Reads the entries of a directory.
 * @param path - The path to the directory.
 * @returns A promise that resolves to an array of directory entries.
 */
async function readDir(
  path: string
): Promise<{ name: string; isDirectory: () => boolean; isFile: () => boolean }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory(),
    isFile: () => entry.isFile(),
  }));
}

/**
 * Options for the build command.
 */
interface BuildOptions {
  outputDirectory: string;
  config?: string;
  functionsDirectory?: string;
}

/**
 * The build command definition.
 */
export const buildCommand = new Command('build')
  .description('Builds all functions using esbuild.')
  .option('-o, --output-directory <outputDirectory>', 'The output directory.', 'dist')
  .option('-c, --config <config>', 'Path to the package.json config file.')
  .option(
    '--functionsDirectory <functionsDirectory>',
    'The directory where the functions are located.'
  )
  .action(async (options: BuildOptions) => {
    logger.info(chalk.bold.green('Starting build with esbuild...'));
    logger.debug('Options:', options);

    const functionsDirectory = options.functionsDirectory || 'src/controllers';
    const functionsPath = join(cwd(), functionsDirectory);
    const functionFiles = await findFunctions(functionsPath);

    if (functionFiles.length === 0) {
      logger.info(chalk.yellow('No functions found to build.'));
      return;
    }

    logger.info(chalk.bold.cyan(`Found ${functionFiles.length} functions to build.`));

    for (const funcPath of functionFiles) {
      const functionName = basename(funcPath).replace(/\.(ts|tsx|js)$/, '');
      const functionOutputDir = join(cwd(), options.outputDirectory, functionName);
      const outputFile = join(functionOutputDir, 'src', 'index.js');
      const configPath = options.config ? join(cwd(), options.config) : undefined;

      logger.info(`Building function: ${chalk.bold.yellow(functionName)}`);
      logger.info(`Output file: ${outputFile}`);
      if (configPath) {
        logger.info(`Using config file: ${configPath}`);
      }

      try {
        await buildFunction({
          inputFile: funcPath,
          outputFile,
          configPath,
        });
        logger.info(chalk.green(`Successfully built ${functionName}.`));
      } catch (error) {
        logger.error(chalk.red(`Failed to build ${functionName}:`));
        logger.error(error);
        exit(1);
      }
    }

    logger.info(chalk.bold.green('Build complete!'));
  });

/**
 * Recursively finds all function files in a directory.
 * @param dir - The directory to search.
 * @returns A promise that resolves to an array of file paths.
 */
async function findFunctions(dir: string): Promise<string[]> {
  const functions: string[] = [];
  try {
    const entries = await readDir(dir);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        functions.push(...(await findFunctions(path)));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const name = entry.name;
        if (
          name.endsWith('.test.ts') ||
          name.endsWith('.spec.ts') ||
          name.endsWith('.test.js') ||
          name.endsWith('.spec.js') ||
          name.endsWith('_test.ts') ||
          name.endsWith('_test.js')
        ) {
          continue;
        }
        functions.push(path);
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }
  return functions;
}
