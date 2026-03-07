import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { NodeVersion } from '$types';
import { buildFunction } from '$utils/build_utils.js';
import { exists } from '$utils/common.js';
import { createPackageJson } from '$utils/firebase_utils.js';

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
    logger.info(chalk.bold.green('🛠️  Starting build...'));

    const inputPath = join(cwd(), input);
    const outputPath = join(cwd(), output);

    // 1. Validate Input
    if (!(await exists(inputPath))) {
      logger.error(chalk.red(`❌ Input file not found: ${inputPath}`));
      exit(1);
    }

    const outputDir = dirname(outputPath);

    try {
      // 2. Prepare Output Directory
      await mkdir(outputDir, { recursive: true });

      // 3. Perform Build
      await buildFunction({
        inputFile: inputPath,
        outputFile: outputPath,
        external: options.external,
        nodeVersion: options.nodeVersion,
        minify: options.minify,
        sourcemap: options.sourcemap,
      });

      // 4. Post-build tasks: Generate package.json if missing
      const packageJsonPath = join(dirname(outputDir), 'package.json');
      if (!(await exists(packageJsonPath))) {
        const functionName = basename(dirname(outputDir)) || 'function';
        const packageJson = await createPackageJson({
          nodeVersion: options.nodeVersion || '20',
          external: options.external,
          functionName,
          isEmulator: false,
        });

        await writeFile(packageJsonPath, packageJson);
        logger.info(chalk.dim(`📄 Created package.json at ${packageJsonPath}`));
      }

      logger.info(chalk.bold.green(`✅ Successfully built to ${outputPath}`));
    } catch (error) {
      logger.error(chalk.red('❌ Build failed:'));
      logger.error(error);
      exit(1);
    }
  });
