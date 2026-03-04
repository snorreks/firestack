import { spawn } from 'node:child_process';

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
