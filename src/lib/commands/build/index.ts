import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { cwd, exit } from 'node:process';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '$logger';
import type { BaseCliOptions } from '$types';
import { buildFunction } from '$utils/build_utils.ts';
import { exists } from '$utils/common.ts';
import { createPackageJson } from '$utils/firebase_utils.ts';
import { getBaseOptions } from '$utils/options';

/**
 * Options for the build command.
 */
type BuildOptions = BaseCliOptions & {
  input: string;
  output: string;
};

/**
 * The build command definition.
 */
export const buildCommand = new Command('build')
  .description('Builds a single entry point using esbuild.')
  .argument('<input>', 'The input file path.')
  .argument('<output>', 'The output file path.')
  .option('--flavor <flavor>', 'The flavor to use for configuration.')
  .option('--external <external>', 'Comma-separated list of external dependencies.', (val) =>
    val.split(',')
  )
  .option('--node-version <nodeVersion>', 'The Node.js version to target.')
  .option('--minify', 'Whether to minify the output.')
  .option('--no-minify', 'Do not minify the output.')
  .option('--sourcemap', 'Whether to generate sourcemaps.')
  .option('--no-sourcemap', 'Do not generate sourcemaps.')
  .action(async (input: string, output: string, cliOptions: BuildOptions) => {
    const inputPath = join(cwd(), input);
    const outputPath = join(cwd(), output);

    // 1. Validate Input
    if (!(await exists(inputPath))) {
      logger.error(chalk.red(`❌ Input file not found: ${inputPath}`));
      exit(1);
    }

    const outputDir = dirname(outputPath);

    try {
      const options = await getBaseOptions(cliOptions);

      // 2. Prepare Output Directory
      await mkdir(outputDir, { recursive: true });

      const nodeVersion = options.nodeVersion;

      // 3. Perform Build
      await buildFunction({
        inputFile: inputPath,
        outputFile: outputPath,
        external: options.external,
        nodeVersion,
        minify: options.minify,
        sourcemap: options.sourcemap,
      });

      // 4. Post-build tasks: Generate package.json in the output directory
      const packageJsonPath = join(outputDir, 'package.json');
      const functionName = basename(outputDir) || 'function';
      const packageJson = await createPackageJson({
        nodeVersion,
        external: options.external,
        functionName,
        isEmulator: false,
      });

      await writeFile(packageJsonPath, packageJson);

      logger.info(chalk.bold.green(`✅ Successfully built to ${outputPath}`));
    } catch (error) {
      logger.error(chalk.red('❌ Build failed:'));
      logger.error(error as Error);
      exit(1);
    }
  });
