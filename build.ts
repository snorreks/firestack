#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import esbuild from 'esbuild';

const __dirname = join(fileURLToPath(import.meta.url), '..');

console.log('🚀 Building with esbuild...');

// Read package.json version
const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf-8'));
const version = pkg.version;

// Update src/main.ts version
const mainPath = join(__dirname, 'src', 'main.ts');
let mainContent = await readFile(mainPath, 'utf-8');
mainContent = mainContent.replace(/\.version\(['"].*?['"]\)/, `.version('${version}')`);
await writeFile(mainPath, mainContent);

// 4. clear dist at the start every time we run build.ts
await rm(join(__dirname, 'dist'), { recursive: true, force: true });
await mkdir(join(__dirname, 'dist'), { recursive: true });

/**
 * Compiles the firestack skill directory into a zip file.
 * Uses archiver (pure JavaScript), so no external python/zip tools are required
 * and it works identically on Windows, macOS, and Linux.
 * Skips compilation when running in CI.
 * @returns A promise that resolves when compilation is complete
 */
const compileSkill = async (): Promise<void> => {
  if (process.env.CI) {
    console.log('🔧 CI detected, skipping skill compilation');
    return;
  }

  const skillDir = join(__dirname, '.agents', 'skills', 'firestack');
  const skillFile = join(__dirname, 'firestack.skill');

  console.log('📦 Compiling firestack.skill...');

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(skillFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') {
        reject(error);
      }
    });

    archive.pipe(output);
    // `false` keeps entries relative to the skill dir, so SKILL.md sits at the zip root
    archive.directory(skillDir, false);
    archive.finalize().catch(reject);
  });

  console.log('✅ firestack.skill compiled');
};

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
  // Testing helper entry point
  esbuild.build({
    entryPoints: ['src/lib/testing/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist/testing',
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
  // Generate types for testing helper
  new Promise((resolve, reject) => {
    const proc = spawn(
      'bun',
      [
        'x',
        'tsup',
        'src/lib/testing/index.ts',
        '--dts-only',
        '--no-clean',
        '--format',
        'esm',
        '--outDir',
        'dist/testing',
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
    const { scripts, devDependencies, ...distPkg } = pkg;
    await writeFile(
      join(__dirname, 'dist', 'package.json'),
      `${JSON.stringify(distPkg, null, 2)}\n`
    );
  })(),
  compileSkill(),
]);

console.log('✅ Done!');
