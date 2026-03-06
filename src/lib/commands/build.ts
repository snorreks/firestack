import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { NodeVersion } from '$types';
import { buildFunction } from '$utils/build_utils.js';
import { exists } from '$utils/common.js';

/**
 * Options for the build command.
 */
interface BuildOptions {
  input: string;
  output: string;
  external?: string[];
  nodeVersion?: NodeVersion;
  minify?: boolean;
  sourcemap?: boolean;
}

/**
 * The build command definition.
 */
export const buildCommand = new Command('build')
  .description('Builds a single entry point using esbuild.')
  .argument('<input>', 'The input file path.')
  .argument('<output>', 'The output file path.')
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .option('--node-version <nodeVersion>', 'The Node.js version to target.', '20')
  .option('--minify', 'Whether to minify the output.', true)
  .option('--no-minify', 'Do not minify the output.')
  .option('--sourcemap', 'Whether to generate sourcemaps.', true)
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .action(async (input: string, output: string, options: BuildOptions) => {
    logger.info(chalk.bold.green('Starting build...'));

    const inputPath = join(cwd(), input);
    const outputPath = join(cwd(), output);

    if (!(await exists(inputPath))) {
      logger.error(chalk.red(`Input file not found: ${inputPath}`));
      exit(1);
    }

    const outputDir = dirname(outputPath);
    await mkdir(outputDir, { recursive: true });

    try {
      await buildFunction({
        inputFile: inputPath,
        outputFile: outputPath,
        external: options.external,
        nodeVersion: options.nodeVersion,
        minify: options.minify,
        sourcemap: options.sourcemap,
      });

      // Create a basic package.json in the output directory's parent (assuming functions structure)
      // or just alongside the output if it's a single file.
      // Usually for Firebase, we need a package.json where the functions are.
      const packageJsonPath = join(dirname(outputDir), 'package.json');
      if (!(await exists(packageJsonPath))) {
        const pkg = {
          name: basename(dirname(outputDir)) || 'function',
          main: join('src', basename(outputPath)),
          type: 'module',
          dependencies: {} as Record<string, string>,
        };

        if (options.external) {
          for (const ext of options.external) {
            pkg.dependencies[ext] = '*';
          }
        }

        await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2));
        logger.info(chalk.blue(`Created package.json at ${packageJsonPath}`));
      }

      logger.info(chalk.green(`Successfully built to ${outputPath}`));
    } catch (error) {
      logger.error(chalk.red('Build failed:'));
      logger.error(error);
      exit(1);
    }
  });
