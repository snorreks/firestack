import { type ExecaError, type Options as ExecaOptions, execa } from 'execa';
import type { PackageManager } from '$lib/commands/deploy/utils/options.js';
import { logger } from '$logger';

export interface CommandOptions extends ExecaOptions {
  args?: string[];
  packageManager?: PackageManager;
}

/**
 * A wrapper for execa that supports local command execution via package managers.
 */
export async function executeCommand(
  cmd: string,
  options: CommandOptions = {}
): Promise<{ code: number; stdout: string; stderr: string; success: boolean }> {
  const { args = [], packageManager = 'global', ...execaOptions } = options;

  let finalCmd = cmd;
  let finalArgs = [...args];

  if (cmd === 'firebase' && packageManager !== 'global') {
    switch (packageManager) {
      case 'bun':
        finalCmd = 'bun';
        finalArgs = ['x', 'firebase', ...args];
        break;
      case 'pnpm':
        finalCmd = 'pnpm';
        finalArgs = ['dlx', 'firebase', ...args];
        break;
      case 'yarn':
        finalCmd = 'yarn';
        finalArgs = ['dlx', 'firebase', ...args];
        break;
      default:
        finalCmd = 'npx';
        finalArgs = ['firebase', ...args];
        break;
    }
  }

  logger.debug(`Executing: ${finalCmd} ${finalArgs.join(' ')}`);
  if (execaOptions.cwd) {
    logger.debug(`Working directory: ${execaOptions.cwd}`);
  }

  const isVerbose = logger.currentLogSeverity === 'debug';

  try {
    const result = await execa(finalCmd, finalArgs, {
      ...execaOptions,
      stdout: execaOptions.stdout ?? (isVerbose ? 'inherit' : 'pipe'),
      stderr: execaOptions.stderr ?? (isVerbose ? 'inherit' : 'pipe'),
    });

    return {
      code: result.exitCode ?? 0,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
      success: true,
    };
  } catch (error) {
    const err = error as ExecaError;
    return {
      code: err.exitCode ?? 1,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : '',
      success: false,
    };
  }
}
