import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { buildFunction } from '../utils/build_utils.js';

function cwdDir(): string {
  return cwd();
}

function exitCode(code: number): never {
  return exit(code);
}

async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, 'utf-8');
}

async function readDir(
  path: string
): Promise<{ name: string; isDirectory: () => boolean; isFile: () => boolean }[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory(),
    isFile: () => entry.isFile(),
  }));
}

interface BuildOptions {
  outputDirectory: string;
  config?: string;
  functionsDirectory?: string;
}

export const buildCommand = new Command('build')
  .description('Builds all functions using esbuild.')
  .option('-o, --output-directory <outputDirectory>', 'The output directory.', 'dist')
  .option('-c, --config <config>', 'Path to the package.json config file.')
  .option(
    '--functionsDirectory <functionsDirectory>',
    'The directory where the functions are located.'
  )
  .action(async (options: BuildOptions) => {
    console.log(chalk.bold.green('Starting build with esbuild...'));
    console.log('Options:', options);

    const functionsDirectory = options.functionsDirectory || 'src/controllers';
    const functionsPath = join(cwdDir(), functionsDirectory);
    const functionFiles = await findFunctions(functionsPath);

    if (functionFiles.length === 0) {
      console.log(chalk.yellow('No functions found to build.'));
      return;
    }

    console.log(chalk.bold.cyan(`Found ${functionFiles.length} functions to build.`));

    for (const funcPath of functionFiles) {
      const functionName = basename(funcPath).replace(/\.(ts|tsx|js)$/, '');
      const functionOutputDir = join(cwdDir(), options.outputDirectory, functionName);
      const outputFile = join(functionOutputDir, 'src', 'index.js');
      const configPath = options.config ? join(cwdDir(), options.config) : undefined;

      console.log(`Building function: ${chalk.bold.yellow(functionName)}`);
      console.log(`Output file: ${outputFile}`);
      if (configPath) {
        console.log(`Using config file: ${configPath}`);
      }

      try {
        await buildFunction({
          inputFile: funcPath,
          outputFile,
          configPath,
        });
        console.log(chalk.green(`Successfully built ${functionName}.`));
      } catch (error) {
        console.error(chalk.red(`Failed to build ${functionName}:`));
        console.error(error);
        exitCode(1);
      }
    }

    console.log(chalk.bold.green('Build complete!'));
  });

async function findFunctions(dir: string): Promise<string[]> {
  const functions: string[] = [];
  try {
    const entries = await readDir(dir);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        functions.push(...(await findFunctions(path)));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const name = entry.name;
        if (
          name.endsWith('.test.ts') ||
          name.endsWith('.spec.ts') ||
          name.endsWith('.test.js') ||
          name.endsWith('.spec.js') ||
          name.endsWith('_test.ts') ||
          name.endsWith('_test.js')
        ) {
          continue;
        }
        functions.push(path);
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }
  return functions;
}
