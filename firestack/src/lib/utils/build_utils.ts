import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';
import { logger } from './logger.js';

interface BuildFunctionOptions {
  inputFile: string;
  outputFile: string;
  configPath?: string;
  minify?: boolean;
  sourcemap?: boolean;
}

export async function buildFunction(options: BuildFunctionOptions): Promise<void> {
  const { inputFile, outputFile, minify, sourcemap } = options;

  const outDir = dirname(outputFile);
  await mkdir(outDir, { recursive: true });

  const banner = {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  };

  try {
    await build({
      entryPoints: [inputFile],
      outfile: outputFile,
      bundle: true,
      format: 'esm',
      platform: 'node',
      // external: ['firebase-functions', 'firebase-admin'],
      minify,
      sourcemap,
      banner,
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
    });
  } catch (error) {
    logger.error('buildFunction', {
      error,
      options,
    });
    throw error;
  }
}
