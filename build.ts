#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * Skips compilation when running in CI or when no zip tool is available.
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

  const compileWithPython = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        'python3',
        [
          '-c',
          `import zipfile, os
skill_dir = os.sys.argv[1]
skill_file = os.sys.argv[2]
with zipfile.ZipFile(skill_file, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(skill_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, skill_dir)
            zf.write(file_path, arcname)
        for dir in dirs:
            dir_path = os.path.join(root, dir)
            if not os.listdir(dir_path):
                arcname = os.path.relpath(dir_path, skill_dir) + '/'
                zf.write(dir_path, arcname)
print(f"Created {skill_file}")`,
          skillDir,
          skillFile,
        ],
        {
          cwd: __dirname,
          stdio: 'inherit',
        }
      );
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`python3 failed with code ${code}`));
      });
    });
  };

  const compileWithZip = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const proc = spawn('sh', ['-c', `cd "${skillDir}" && zip -r "${skillFile}" .`], {
        cwd: __dirname,
        stdio: 'inherit',
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`zip failed with code ${code}`));
      });
    });
  };

  const hasCommand = (command: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const proc = spawn('which', [command], { stdio: 'ignore' });
      proc.on('close', (code) => resolve(code === 0));
    });
  };

  if (await hasCommand('python3')) {
    await compileWithPython();
    console.log('✅ firestack.skill compiled');
    return;
  }

  if (await hasCommand('zip')) {
    await compileWithZip();
    console.log('✅ firestack.skill compiled');
    return;
  }

  console.warn(
    '⚠️  Neither python3 nor zip command found. Skipping firestack.skill compilation.\n' +
      '   Install python3 or zip to enable automatic skill compilation on build.'
  );
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
