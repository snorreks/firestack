#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

await Promise.all([
  new Promise((resolve) => {
    const proc = spawn('bun', ['x', 'tsup'], {
      cwd: __dirname,
      stdio: 'inherit',
    });
    proc.on('close', () => resolve(0));
  }),
  cp(join(__dirname, 'README.md'), join(__dirname, 'dist', 'README.md')),
  cp(join(__dirname, 'firestack.schema.json'), join(__dirname, 'dist', 'firestack.schema.json')),
  rm(join(__dirname, 'dist', 'main.d.ts'), { force: true }),
]);

const mainJsPath = join(__dirname, 'dist', 'main.js');
const mainJs = await readFile(mainJsPath, 'utf-8');
await writeFile(mainJsPath, `#!/usr/bin/env node\n${mainJs}`);

const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf-8'));
const { scripts, devDependencies, ...distPkg } = pkg;
await writeFile(join(__dirname, 'dist', 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`);

console.log('Done!');
