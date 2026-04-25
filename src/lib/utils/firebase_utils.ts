import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { exists, getDependencyVersion } from '$utils/common.ts';

/**
 * Creates a firebase.json file content.
 * @param options - The options for creating the config.
 * @returns The firebase.json content.
 */
export const createFirebaseConfig = (options: {
  nodeVersion: string;
  functionName?: string;
}): string => {
  const { nodeVersion } = options;
  const config = {
    functions: {
      runtime: `nodejs${nodeVersion}`,
      source: '.',
    },
  };

  return JSON.stringify(config, null, 2);
};

/**
 * Resolves dependencies for a function's package.json.
 * For emulators, includes firebase-admin and firebase-functions.
 * For external deps, marks them with wildcard version.
 * @param options - The dependency resolution options.
 * @returns The resolved dependencies, or undefined if none.
 */
const getDependencies = async (options: {
  isEmulator?: boolean;
  external?: string[];
  engine?: string;
}): Promise<Record<string, string> | undefined> => {
  const { external = [], isEmulator, engine } = options;
  if (!isEmulator && external.length === 0) {
    return undefined;
  }

  const dependencies: Record<string, string> = {};

  if (isEmulator && external.length === 0) {
    // Always include core Firebase dependencies with user-respected versions
    const [adminVersion, functionsVersion] = await Promise.all([
      getDependencyVersion('firebase-admin'),
      getDependencyVersion('firebase-functions'),
    ]);

    dependencies['firebase-admin'] = adminVersion || '^13.0.0';
    dependencies['firebase-functions'] = functionsVersion || '^7.0.0';
  }

  for (const ext of external) {
    dependencies[ext] = '*';
  }

  // Firebase requires the Functions Framework when using Bun
  if (engine === 'bun' && !isEmulator && external.length > 0) {
    dependencies['@google-cloud/functions-framework'] = '^3.0.0';
  }

  return dependencies;
};

/**
 * Creates a package.json file content.
 * @param options - The options for creating the package.json.
 * @returns The package.json content.
 */
export const createPackageJson = async (options: {
  nodeVersion: string;
  external?: string[];
  functionName?: string;
  isEmulator?: boolean;
  main?: string;
  engine?: string;
}): Promise<string> => {
  const { nodeVersion, functionName = 'functions', main = 'index.js' } = options;
  const dependencies = await getDependencies(options);

  const pkg: Record<string, unknown> = {
    name: `firestack-function-${functionName.replace(/_/g, '-')}`,
    private: true,
    type: 'module',
    main,
    engines: {
      node: nodeVersion,
    },
  };

  if (dependencies && Object.keys(dependencies).length > 0) {
    pkg.dependencies = dependencies;
  }

  return JSON.stringify(pkg, null, 2);
};

/**
 * Generates dot environment code.
 * @param options - The environment variables.
 * @returns The dot environment code.
 */
export const toDotEnvironmentCode = (options: { env: Record<string, string> }): string => {
  const { env } = options;
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

/**
 * Copies the environment file to the output directory.
 * @param options - The options for copying the env file.
 */
export const copyEnvFile = async (options: {
  flavor: string;
  outputDir: string;
}): Promise<void> => {
  const { flavor, outputDir } = options;
  const envSourcePath = join(cwd(), `.env.${flavor}`);
  const envDestPath = join(outputDir, '.env');

  const sourceExists = await exists(envSourcePath);
  if (sourceExists) {
    await copyFile(envSourcePath, envDestPath);
  }
};
