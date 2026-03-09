#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = join(fileURLToPath(import.meta.url), '..');

console.log('🚀 Building with esbuild...');

// 4. clear dist at the start every time we run build.ts
await rm(join(__dirname, 'dist'), { recursive: true, force: true });
await mkdir(join(__dirname, 'dist'), { recursive: true });

await Promise.all([
  // 1. use esbuild directly
  // 2. for main.js add #!/usr/bin/env node
  esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    packages: 'external',
    banner: {
      js: '#!/usr/bin/env node',
    },
  }),
  // 1. use esbuild directly
  esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    packages: 'external',
  }),
  // Generate types using tsup (dts-only)
  new Promise((resolve, reject) => {
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
    proc.on('close', (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`tsup failed with code ${code}`));
    });
  }),
  cp(join(__dirname, 'README.md'), join(__dirname, 'dist', 'README.md')),
  cp(join(__dirname, 'firestack.schema.json'), join(__dirname, 'dist', 'firestack.schema.json')),
  // 3. add the package.json function inside the parrallell stuff
  (async () => {
    const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf-8'));
    const { scripts, devDependencies, ...distPkg } = pkg;
    await writeFile(
      join(__dirname, 'dist', 'package.json'),
      `${JSON.stringify(distPkg, null, 2)}\n`
    );
  })(),
]);

console.log('✅ Done!');
