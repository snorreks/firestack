#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

console.log('🚀 Building with Bun...');

// Start all tasks in parallel
const [buildResult] = await Promise.all([
  // 1. Bundle JS using Bun's native builder
  Bun.build({
    entrypoints: ['./src/main.ts', './src/index.ts'],
    outdir: './dist',
    target: 'node',
    // Equivalent to esbuild's --packages=external
    external: ['*'],
    naming: '[name].[ext]',
  }),

  // 2. Generate types using tsup
  new Promise((resolve) => {
    const proc = spawn(
      'bun',
      [
        'x',
        'tsup',
        'src/index.ts',
        '--dts-only',
        '--no-clean',
        '--format',
        'esm',
        '--outDir',
        'dist',
      ],
      {
        cwd: __dirname,
        stdio: 'inherit',
      }
    );
    proc.on('close', () => resolve(0));
  }),

  // 3. Copy assets
  cp(join(__dirname, 'README.md'), join(__dirname, 'dist', 'README.md')),
  cp(join(__dirname, 'firestack.schema.json'), join(__dirname, 'dist', 'firestack.schema.json')),
]);

// Check if Bun build was successful
if (!buildResult.success) {
  console.error('❌ Build failed');
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// 4. Add shebang to main.js
const mainJsPath = join(__dirname, 'dist', 'main.js');
const mainJs = await readFile(mainJsPath, 'utf-8');
await writeFile(mainJsPath, `#!/usr/bin/env node\n${mainJs}`);

// 5. Cleanup package.json for distribution
const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf-8'));
const { scripts, devDependencies, ...distPkg } = pkg;
await writeFile(join(__dirname, 'dist', 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`);

// Remove the d.ts for main as it's not needed for the CLI consumer
await rm(join(__dirname, 'dist', 'main.d.ts'), { force: true });

console.log('✅ Done!');
