import { type ExecaError, execa, type Subprocess } from 'execa';
import { logger } from '$logger';
import type { PackageManager } from '$types';
import { resolveFirebaseCommand } from '$utils/firebase_tools.ts';

const ANSI_ESCAPE_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*[A-Za-z]`, 'g');

/**
 * Checks whether a line looks like Firebase CLI's normal progress output
 * (not an interactive prompt). Used to detect when the interactive session
 * has ended and normal output has resumed.
 */
const isFirebaseProgressLine = (line: string): boolean => {
  // Strip ANSI escape codes for detection
  const clean = line.replace(ANSI_ESCAPE_RE, '').trim();
  if (!clean) return false;
  // Firebase CLI log prefixes: `i  `, `✔  `, `⚠  `, `✖  `, `=== `, `⚠ `
  if (/^[i✔⚠✖] {2}/.test(clean)) return true;
  if (clean.startsWith('=== ')) return true;
  if (clean.startsWith('⚠ ')) return true;
  return false;
};

/**
 * Installs a data handler on the subprocess stdout that selectively echoes
 * only interactive prompts (inquirer questions) to the terminal.
 * Normal Firebase progress output is captured but not shown.
 *
 * When an interactive prompt is detected, recent buffered context lines
 * are flushed first so the user has context for the prompt.
 *
 * @param subprocess - The execa subprocess
 * @returns A cleanup function that removes the listener
 */
const installInteractiveFilter = (subprocess: Subprocess): (() => void) => {
  if (!subprocess.stdout) {
    return () => {};
  }

  let lineBuffer = '';
  let isInInteractive = false;
  const contextChunks: string[] = [];
  const MAX_CONTEXT_CHUNKS = 60;

  const onData = (chunk: Buffer) => {
    const data = chunk.toString();

    // Always capture via the stream (execa result.stdout will still have it)

    // Check for interactive markers in the raw chunk (before line-splitting)
    const hasPrompt = /\? /.test(data) || data.includes('❯');

    if (hasPrompt && !isInInteractive) {
      // Flush recent context so user understands the prompt
      for (const ctx of contextChunks) {
        process.stdout.write(ctx);
      }
      contextChunks.length = 0;
      isInInteractive = true;
    }

    if (isInInteractive) {
      process.stdout.write(data);

      // Accumulate lines to detect when interactive mode ends
      lineBuffer += data;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (isFirebaseProgressLine(line)) {
          isInInteractive = false;
          break;
        }
      }
    } else {
      // Buffer for context
      contextChunks.push(data);
      while (contextChunks.length > MAX_CONTEXT_CHUNKS) {
        contextChunks.shift();
      }
    }
  };

  subprocess.stdout.on('data', onData);
  return () => {
    subprocess.stdout?.removeListener('data', onData);
  };
};

export type CommandOptions = {
  args?: string[];
  packageManager?: PackageManager;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onSubprocess?: (subprocess: Subprocess) => void;
  cwd?: string;
  stdin?: 'pipe' | 'inherit' | 'ignore';
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
    onSubprocess,
    cwd,
    stdin,
    stdout,
    stderr,
    env,
  } = options ?? {};

  let finalCmd = cmd;
  let finalArgs = [...args];
  let finalEnv = env;

  if (packageManager === 'global') {
    const pathEnv = process.env.PATH ?? '';
    const separator = process.platform === 'win32' ? ';' : ':';
    const cleanedPath = pathEnv
      .split(separator)
      .filter((segment) => !segment.replace(/\\/g, '/').includes('node_modules/.bin'))
      .join(separator);
    finalEnv = { ...env, PATH: cleanedPath };
  }

  if (cmd === 'firebase') {
    if (packageManager === 'global') {
      const resolved = await resolveFirebaseCommand();
      finalCmd = resolved.cmd;
      finalArgs = [...resolved.args, ...args];
    } else {
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
  }

  logger.debug(`Executing: ${finalCmd} ${finalArgs.join(' ')}`);
  if (cwd) {
    logger.debug(`Working directory: ${cwd}`);
  }

  // Non-verbose mode: pipe everything, selectively echo only interactive prompts.
  // Interactive content (inquirer prompts) always goes to stdout, while Firebase
  // progress/spinner output also goes to stdout, so we filter by content patterns.
  const shouldFilter = !logger.verbose && !stdout && !stderr;
  let cleanupFilter: (() => void) | undefined;

  try {
    const subprocess = execa(finalCmd, finalArgs, {
      cwd,
      env: finalEnv,
      stdin: stdin ?? 'inherit',
      stdout: stdout ?? (shouldFilter ? 'pipe' : ['inherit', 'pipe']),
      stderr: stderr ?? (shouldFilter ? 'pipe' : ['inherit', 'pipe']),
    });

    if (onSubprocess) {
      onSubprocess(subprocess);
    }

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

    // In non-verbose mode, install a selective echo filter that shows only
    // interactive prompts (inquirer) to the terminal while keeping noisy
    // Firebase progress output hidden.
    if (shouldFilter) {
      cleanupFilter = installInteractiveFilter(subprocess);
    }

    const result = await subprocess;
    cleanupFilter?.();

    return {
      code: result.exitCode ?? 0,
      stdout: typeof result.stdout === 'string' ? result.stdout : '',
      stderr: typeof result.stderr === 'string' ? result.stderr : '',
      success: true,
    };
  } catch (error) {
    cleanupFilter?.();
    const err = error as ExecaError;
    return {
      code: err.exitCode ?? 1,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : '',
      success: false,
    };
  }
};
