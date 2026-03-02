import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, watch } from 'node:fs';
import { mkdir as mkdirProm, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cwd, exit } from 'node:process';

export { spawn } from 'node:child_process';
export { existsSync, mkdirSync, watch } from 'node:fs';
export { readdir, readFile, rm, stat } from 'node:fs/promises';
export { dirname } from 'node:path';
export { cwd, exit } from 'node:process';
export { TextDecoder, TextEncoder } from 'node:util';

export const errors = {
  NotFound: class NotFound extends Error {
    code = 'ENOENT';
  },
};

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  await writeFile(path, contents, 'utf-8');
}

export async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
  await mkdirProm(path, { recursive: options?.recursive ?? false });
}

export function cwdDir(): string {
  return cwd();
}

export function exitCode(code: number): never {
  return exit(code);
}

export async function readDir(
  path: string
): Promise<{ name: string; isDirectory: () => boolean; isFile: () => boolean }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory(),
    isFile: () => entry.isFile(),
  }));
}

export async function remove(path: string, options?: { recursive?: boolean }): Promise<void> {
  await rm(path, { recursive: options?.recursive ?? false, force: true });
}

export function watchFs(path: string): AsyncIterable<{ kind: string; paths: string[] }> {
  const watcher = watch(path, { recursive: true });
  return new AsyncIterable(
    (async function* () {
      for await (const event of watcher) {
        yield { kind: event.eventType, paths: [event.filename] };
      }
    })()
  );
}

export class Command {
  private cmd: string;
  private args: string[] = [];
  private opts: {
    cwd?: string;
    env?: Record<string, string>;
    stdout?: 'inherit' | 'pipe';
    stderr?: 'inherit' | 'pipe';
  } = {};

  constructor(
    cmd: string,
    options?: {
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stdout?: 'inherit' | 'pipe';
      stderr?: 'inherit' | 'pipe';
    }
  ) {
    this.cmd = cmd;
    if (options?.args) this.args = options.args;
    if (options?.cwd) this.opts.cwd = options.cwd;
    if (options?.env) this.opts.env = options.env;
    if (options?.stdout) this.opts.stdout = options.stdout;
    if (options?.stderr) this.opts.stderr = options.stderr;
  }

  async output(): Promise<{ code: number; stdout: Uint8Array; stderr: Uint8Array }> {
    return new Promise((resolve) => {
      const child = spawn(this.cmd, this.args, {
        cwd: this.opts.cwd,
        env: { ...process.env, ...this.opts.env },
      });
      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout = Buffer.concat([stdout, Buffer.from(data)]);
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr = Buffer.concat([stderr, Buffer.from(data)]);
        });
      }
      child.on('close', (code) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  }

  spawn(): { status: Promise<{ code: number; success: boolean }> } {
    const child = spawn(this.cmd, this.args, {
      cwd: this.opts.cwd,
      env: { ...process.env, ...this.opts.env },
      stdio: ['ignore', this.opts.stdout ?? 'inherit', this.opts.stderr ?? 'inherit'],
    });
    return {
      status: new Promise((resolve) => {
        child.on('close', (code) => {
          resolve({ code: code ?? 0, success: code === 0 });
        });
      }),
    };
  }
}
