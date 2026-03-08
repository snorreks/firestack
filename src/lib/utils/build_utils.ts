import { mkdir } from 'node:fs/promises';
import { dirname as _dirname, dirname } from 'node:path';
import { type BuildOptions, build, type SameShape } from 'esbuild';
import { DEFAULT_NODE_VERSION } from '$lib/constants';
import { logger } from '$logger';
import type { NodeVersion } from '$types';

export type BuildFunctionOptions = {
  inputFile: string;
  outputFile: string;
  configPath?: string;
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  sourceRoot?: string;
  keepNames?: boolean;
  footer?: string;
  nodeVersion?: NodeVersion;
  requireFix?: boolean;
  tsconfig?: string;
  __dirnameFix?: boolean;
  __filenameFix?: boolean;
};

type ToBannerOptions = {
  __dirnameFix?: boolean;
  __filenameFix?: boolean;
  requireFix?: boolean;
  inputFile: string;
};

const toBanner = (
  options: ToBannerOptions
):
  | {
      js: string;
    }
  | undefined => {
  const { __dirnameFix = true, __filenameFix = true, requireFix = true, inputFile } = options;
  if (!__dirnameFix && !__filenameFix && !requireFix) {
    return undefined;
  }

  let js = '';
  if (__dirnameFix) {
    const dir = _dirname(inputFile).replace(/\\/g, '\\\\');
    js += `const __dirname='${dir}';`;
  }
  if (__filenameFix) {
    const filename = inputFile.replace(/\\/g, '\\\\');
    js += `const __filename='${filename}';`;
  }
  if (requireFix) {
    js += "import {createRequire} from 'module';const require=createRequire(import.meta.url);";
  }
  return { js };
};

export const buildFunction = async (options: BuildFunctionOptions): Promise<void> => {
  const {
    inputFile,
    outputFile,
    external,
    sourceRoot,
    keepNames,
    footer,
    sourcemap,
    tsconfig,
    minify = true,
  } = options;

  const outDir = dirname(outputFile);
  await mkdir(outDir, { recursive: true });

  try {
    const esbuildOptions: SameShape<BuildOptions, BuildOptions> = {
      banner: toBanner(options),
      footer: footer ? { js: footer } : undefined,
      bundle: true,
      entryPoints: [inputFile],
      format: 'esm',
      external,
      minify,
      sourcemap,
      treeShaking: true,
      tsconfig,
      outfile: outputFile,
      platform: 'node',
      target: `node${options.nodeVersion || DEFAULT_NODE_VERSION}`,
      keepNames,
      sourceRoot,
    } as const;

    logger.debug('executeEsbuild:build', esbuildOptions);

    const result = await build(esbuildOptions);

    if (result.errors?.length) {
      throw new Error(result.errors[0].text);
    }
  } catch (error) {
    logger.error('buildFunction', {
      error,
      options,
    });
    throw error;
  }
};
