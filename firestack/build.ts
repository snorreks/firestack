#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Building...');

  const [mainResult, indexResult, typesResult] = await Promise.all([
    esbuild.build({
      entryPoints: ['src/main.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: 'dist',
      packages: 'external',
      banner: { js: '#!/usr/bin/env node' },
    }),
    esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: 'dist',
      packages: 'external',
    }),
    (async () => {
      console.log('Generating type definitions...');
      const proc = Bun.spawn([
        'bunx',
        'tsc',
        '--declaration',
        '--declarationDir',
        'dist',
        '--emitDeclarationOnly',
        '--outDir',
        'dist',
        '--skipLibCheck',
        '--noEmit',
        'false',
      ]);
      return await proc.exited;
    })(),
  ]);

  if (mainResult.errors.length > 0) {
    console.error('main.ts build failed:', mainResult.errors);
    process.exit(1);
  }
  if (indexResult.errors.length > 0) {
    console.error('index.ts build failed:', indexResult.errors);
    process.exit(1);
  }
  if (typesResult !== 0) {
    console.warn('Type generation had errors (continuing anyway)');
  }

  const pkg = JSON.parse(await Bun.file(join(__dirname, 'package.json')).text());

  // Destructure out the fields we DON'T want, keeping everything else in distPkg
  const { scripts, devDependencies, ...distPkg } = pkg;

  const distDir = join(__dirname, 'dist');
  if (!existsSync(distDir)) {
    await mkdir(distDir, { recursive: true });
  }

  console.log('Creating dist/package.json...');
  await Bun.write(join(distDir, 'package.json'), `${JSON.stringify(distPkg, null, 2)}\n`);

  console.log('Copying README.md to dist...');
  await cp(join(__dirname, '../README.md'), join(distDir, 'README.md'));

  console.log('Done!');
}

main();
