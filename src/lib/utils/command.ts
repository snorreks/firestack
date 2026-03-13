import { type ExecaError, execa } from 'execa';
import { logger } from '$logger';
import type { PackageManager } from '$types';

export type CommandOptions = {
  args?: string[];
  packageManager?: PackageManager;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  cwd?: string;
  stdout?: 'pipe' | 'inherit' | ['inherit', 'pipe'];
  stderr?: 'pipe' | 'inherit' | ['inherit', 'pipe'];
  stdio?: 'pipe' | 'inherit' | ['inherit', 'pipe'];
  env?: Record<string, string>;
};

/**
 * A wrapper for execa that supports local command execution via package managers.
 */
export const executeCommand = async (
  cmdOrOptions: string | { cmd: string; options?: CommandOptions },
  execaOptions?: CommandOptions
): Promise<{ code: number; stdout: string; stderr: string; success: boolean }> => {
  // Support both old syntax: executeCommand('cmd', { args: [] })
  // and new syntax: executeCommand({ cmd: 'cmd', options: { args: [] } })
  const { cmd, options } =
    typeof cmdOrOptions === 'string'
      ? { cmd: cmdOrOptions, options: execaOptions }
      : { cmd: cmdOrOptions.cmd, options: cmdOrOptions.options };

  const {
    args = [],
    packageManager = 'global',
    onStdout,
    onStderr,
    cwd,
    stdout,
    stderr,
    env,
  } = options ?? {};

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
  if (cwd) {
    logger.debug(`Working directory: ${cwd}`);
  }

  const isVerbose = logger.currentLogSeverity === 'debug';

  try {
    const subprocess = execa(finalCmd, finalArgs, {
      cwd,
      env,
      stdout: stdout ?? (isVerbose ? ['inherit', 'pipe'] : 'pipe'),
      stderr: stderr ?? (isVerbose ? ['inherit', 'pipe'] : 'pipe'),
    });

    if (subprocess.stdout) {
      subprocess.stdout.on('data', (chunk) => {
        const data = chunk.toString();
        if (onStdout) onStdout(data);
      });
    }
    if (subprocess.stderr) {
      subprocess.stderr.on('data', (chunk) => {
        const data = chunk.toString();
        if (onStderr) onStderr(data);
      });
    }

    const result = await subprocess;

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
};
