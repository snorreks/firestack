import { copyFile, glob, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '$logger';
import type { TestRulesCliOptions } from '$types';
import { executeCommand } from '$utils/command.ts';
import { exists } from '$utils/common.ts';
import { findFreePort } from '$utils/find_free_port.ts';
import { getFirestackConfig, getTestRulesOptions } from '$utils/options.ts';

type RulesTestTarget = 'firestore' | 'storage';

type TestTargetConfig = {
  type: RulesTestTarget;
  rulesFile: string;
  testPattern: string;
  projectId: string;
};

/**
 * Resolves the rules file path.
 * @param options - The rules file name and directory.
 * @returns The absolute path to the rules file, or undefined if not found.
 */
const resolveRulesFile = async (options: {
  rulesFile: string;
  rulesDirectory: string;
}): Promise<string | undefined> => {
  const { rulesFile, rulesDirectory } = options;
  const searchPaths = [
    join(process.cwd(), rulesFile),
    join(process.cwd(), rulesDirectory, rulesFile),
  ];

  for (const path of searchPaths) {
    if (await exists(path)) {
      return path;
    }
  }

  return undefined;
};

/**
 * Prepares a temporary directory with firebase.json for the emulator.
 * @param options - The emulator configuration.
 * @returns The path to the temporary directory.
 */
const prepareEmulatorDirectory = async (options: {
  type: RulesTestTarget;
  rulesFilePath: string;
  port: number;
  projectId: string;
}): Promise<string> => {
  const { type, rulesFilePath, port } = options;
  const tempDir = join(process.cwd(), 'dist', `rules-test-${type}-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  const firebaseConfig: Record<string, unknown> = {
    emulators: {
      singleProjectMode: true,
      [type]: {
        port,
      },
    },
  };

  if (type === 'firestore') {
    firebaseConfig.firestore = {
      rules: 'rules.rules',
    };
  } else if (type === 'storage') {
    firebaseConfig.storage = {
      rules: 'rules.rules',
    };
  }

  await Promise.all([
    writeFile(join(tempDir, 'firebase.json'), JSON.stringify(firebaseConfig, null, 2)),
    copyFile(rulesFilePath, join(tempDir, 'rules.rules')),
  ]);

  return tempDir;
};

/**
 * Waits for the emulator to be ready by monitoring stdout.
 * Captures output in a buffer for error reporting.
 * @param subprocess - The execa subprocess.
 * @param port - The expected emulator port.
 * @param timeoutMs - Timeout in milliseconds.
 */
const waitForEmulatorReady = async (
  subprocess: ReturnType<typeof execa>,
  port: number,
  timeoutMs: number
): Promise<void> => {
  const outputBuffer: string[] = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const recentOutput = outputBuffer.slice(-20).join('\n');
      reject(
        new Error(`Emulator did not start within ${timeoutMs}ms. Recent output:\n${recentOutput}`)
      );
    }, timeoutMs);

    const onData = (data: string) => {
      const text = data.toString();
      outputBuffer.push(text);

      if (text.includes('All emulators ready') || text.includes(`127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        subprocess.stdout?.off('data', onData);
        subprocess.stderr?.off('data', onData);
        resolve();
      }
    };

    subprocess.stdout?.on('data', onData);
    subprocess.stderr?.on('data', onData);

    subprocess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    subprocess.on('exit', (code) => {
      if (code !== 0 && code !== undefined) {
        clearTimeout(timeout);
        const recentOutput = outputBuffer.slice(-20).join('\n');
        reject(new Error(`Emulator exited with code ${code}. Output:\n${recentOutput}`));
      }
    });
  });
};

/**
 * Starts the Firebase emulator for rules testing.
 * @param options - The emulator configuration.
 * @returns The execa subprocess and emulator environment variables.
 */
const startRulesEmulator = async (options: {
  tempDir: string;
  type: RulesTestTarget;
  port: number;
  projectId: string;
  timeoutMs: number;
}): Promise<{
  subprocess: ReturnType<typeof execa>;
  env: Record<string, string>;
}> => {
  const { tempDir, type, port, projectId, timeoutMs } = options;

  const commandArgs = ['emulators:start', '--only', type, '--project', projectId];

  const { resolveFirebaseCommand } = await import('$utils/firebase_tools.ts');
  const resolvedCmd = await resolveFirebaseCommand();

  logger.info(`Starting ${type} emulator (firebase-tools v${resolvedCmd.version})...`);

  const emulatorEnv: Record<string, string> = {
    ...process.env,
    JAVA_OPTS:
      '-XX:+IgnoreUnrecognizedVMOptions --add-opens=java.base/java.nio=ALL-UNNAMED --add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
  };

  if (type === 'firestore') {
    emulatorEnv.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${port}`;
  } else if (type === 'storage') {
    emulatorEnv.FIREBASE_STORAGE_EMULATOR_HOST = `127.0.0.1:${port}`;
  }

  const subprocess = execa(resolvedCmd.cmd, [...resolvedCmd.args, ...commandArgs], {
    cwd: tempDir,
    env: emulatorEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await waitForEmulatorReady(subprocess, port, timeoutMs);

  logger.debug(`${type} emulator ready on port ${port}`);

  return { subprocess, env: emulatorEnv };
};

/**
 * Resolves test files matching the given pattern.
 * @param pattern - The glob pattern to match.
 * @returns Array of matched file paths.
 */
const resolveTestFiles = async (pattern: string): Promise<string[]> => {
  const files: string[] = [];
  try {
    const matches = glob(pattern, { cwd: process.cwd() });
    for await (const match of matches) {
      if (typeof match === 'string') {
        files.push(match);
      }
    }
  } catch {
    if (await exists(pattern)) {
      files.push(pattern);
    }
  }
  return files;
};

/**
 * Runs test files using the configured test runner.
 * @param options - The test configuration.
 * @returns Whether the tests passed.
 */
const runTests = async (options: {
  testPattern: string;
  env: Record<string, string>;
  watch?: boolean;
}): Promise<boolean> => {
  const { testPattern, env, watch } = options;

  const testFiles = await resolveTestFiles(testPattern);
  if (testFiles.length === 0) {
    logger.warn(chalk.yellow(`No test files found for pattern: ${testPattern}`));
    return true;
  }

  const args = watch ? ['test', '--watch', ...testFiles] : ['test', ...testFiles];

  logger.info(chalk.cyan(`Running ${testFiles.length} test file(s): ${testFiles.join(', ')}`));

  const result = await executeCommand('bun', {
    args,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  return result.success;
};

/**
 * Kills the emulator subprocess gracefully, then forcefully if needed.
 * @param subprocess - The execa subprocess to kill.
 * @param type - The emulator type (for logging).
 */
const killEmulator = async (
  subprocess: ReturnType<typeof execa>,
  type: RulesTestTarget
): Promise<void> => {
  if (subprocess.killed) {
    return;
  }
  logger.debug(`Shutting down ${type} emulator...`);
  subprocess.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (!subprocess.killed) {
    subprocess.kill('SIGKILL');
  }
};

/**
 * Runs rules tests for a single target.
 * @param options - The test configuration.
 * @returns Whether the tests passed.
 */
const runTargetTests = async (options: {
  targetConfig: TestTargetConfig;
  rulesDirectory: string;
  watch?: boolean;
  timeoutMs: number;
}): Promise<boolean> => {
  const { targetConfig, rulesDirectory, watch, timeoutMs } = options;
  const { type, rulesFile, testPattern, projectId } = targetConfig;

  logger.info(chalk.bold.cyan(`\n🔥 Testing ${type} rules...`));

  const resolvedRulesFile = await resolveRulesFile({ rulesFile, rulesDirectory });
  if (!resolvedRulesFile) {
    logger.error(chalk.red(`❌ Rules file not found: ${rulesFile}`));
    return false;
  }

  const port = await findFreePort();
  const tempDir = await prepareEmulatorDirectory({
    type,
    rulesFilePath: resolvedRulesFile,
    port,
    projectId,
  });

  let emulatorSubprocess: ReturnType<typeof execa> | undefined;
  let success = false;

  try {
    const { subprocess, env } = await startRulesEmulator({
      tempDir,
      type,
      port,
      projectId,
      timeoutMs,
    });
    emulatorSubprocess = subprocess;

    success = await runTests({ testPattern, env, watch });
  } catch (error) {
    logger.error(chalk.red(`❌ ${type} emulator failed: ${(error as Error).message}`));
    success = false;
  } finally {
    if (emulatorSubprocess) {
      await killEmulator(emulatorSubprocess, type);
    }
  }

  return success;
};

/**
 * Main action for the test:rules command.
 */
export const testRulesAction = async (cliOptions: TestRulesCliOptions) => {
  const testRulesOptions = await getTestRulesOptions(cliOptions);
  const config = await getFirestackConfig();

  if (!config.rulesTests) {
    logger.error(
      chalk.red(
        '❌ No rulesTests configuration found in firestack config. Please add rulesTests.firestore or rulesTests.storage.'
      )
    );
    exit(1);
  }

  const targets: TestTargetConfig[] = [];

  if (config.rulesTests.firestore) {
    targets.push({
      type: 'firestore',
      rulesFile: config.rulesTests.firestore.rulesFile,
      testPattern: config.rulesTests.firestore.testPattern,
      projectId: config.rulesTests.firestore.projectId || 'firestack-rules-test',
    });
  }

  if (config.rulesTests.storage) {
    targets.push({
      type: 'storage',
      rulesFile: config.rulesTests.storage.rulesFile,
      testPattern: config.rulesTests.storage.testPattern,
      projectId: config.rulesTests.storage.projectId || 'firestack-rules-test',
    });
  }

  if (testRulesOptions.only) {
    const onlyTargets = testRulesOptions.only.split(',').map((t) => t.trim());
    const filteredTargets = targets.filter((t) => onlyTargets.includes(t.type));
    if (filteredTargets.length === 0) {
      logger.error(chalk.red(`❌ No matching test targets for --only ${testRulesOptions.only}`));
      exit(1);
    }
    targets.length = 0;
    targets.push(...filteredTargets);
  }

  if (targets.length === 0) {
    logger.error(chalk.red('❌ No rules test targets configured.'));
    exit(1);
  }

  const timeoutMs = (testRulesOptions.timeout ?? 60) * 1000;

  let allPassed = true;

  // Run targets in parallel since each uses its own ephemeral emulator
  const results = await Promise.all(
    targets.map((target) =>
      runTargetTests({
        targetConfig: target,
        rulesDirectory: testRulesOptions.rulesDirectory,
        watch: testRulesOptions.watch,
        timeoutMs,
      })
    )
  );

  for (const passed of results) {
    if (!passed) {
      allPassed = false;
    }
  }

  if (allPassed) {
    logger.info(chalk.bold.green('\n✅ All rules tests passed.'));
  } else {
    logger.error(chalk.bold.red('\n❌ Some rules tests failed.'));
    exit(1);
  }
};

/**
 * The test:rules command definition.
 */
export const testRulesCommand = new Command('test:rules')
  .description('Tests Firestore and Storage security rules using the Firebase emulator.')
  .option('--mode <mode>', 'The mode to use.')
  .option('--verbose', 'Enable verbose logging.')
  .option('--silent', 'Disable logging.')
  .option('--watch', 'Watch test files for changes and re-run.')
  .option('--coverage', 'Show rule coverage (not yet implemented).')
  .option('--ci', 'Fail if any collection lacks tests (not yet implemented).')
  .option('--only <only>', 'Only test specific targets (e.g., "firestore,storage").')
  .option('--timeout <seconds>', 'Emulator startup timeout in seconds.', (val) =>
    Number.parseInt(val, 10)
  )
  .action(testRulesAction);
