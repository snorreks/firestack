import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { exists, getDependencyVersion } from '$utils/common.js';

type CreateFirebaseConfigOptions = {
  nodeVersion: string;
  functionName?: string;
};

/**
 * Creates a firebase.json file content.
 * @param options - The options for creating the config.
 * @returns The firebase.json content.
 */
export const createFirebaseConfig = (options: CreateFirebaseConfigOptions): string => {
  const { nodeVersion } = options;
  const config = {
    functions: {
      runtime: `nodejs${nodeVersion}`,
      source: 'src',
    },
  };

  return JSON.stringify(config, null, 2);
};

type GetDependenciesOptions = {
  isEmulator?: boolean;
  external?: string[];
};

const getDependencies = async (
  options: GetDependenciesOptions
): Promise<Record<string, string> | undefined> => {
  const { external = [], isEmulator } = options;
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

  return dependencies;
};

type CreatePackageJsonOptions = {
  nodeVersion: string;
  external?: string[];
  functionName?: string;
  isEmulator?: boolean;
};

/**
 * Creates a package.json file content.
 * @param options - The options for creating the package.json.
 * @returns The package.json content.
 */
export const createPackageJson = async (options: CreatePackageJsonOptions): Promise<string> => {
  const { nodeVersion, functionName = 'functions' } = options;
  const dependencies = await getDependencies(options);

  const pkg: Record<string, unknown> = {
    name: `firestack-function-${functionName.replace(/_/g, '-')}`,
    private: true,
    type: 'module',
    main: 'index.js',
    engines: {
      node: nodeVersion,
    },
  };

  if (dependencies && Object.keys(dependencies).length > 0) {
    pkg.dependencies = dependencies;
  }

  return JSON.stringify(pkg, null, 2);
};

type ToDotEnvironmentCodeOptions = {
  env: Record<string, string>;
};

/**
 * Generates dot environment code.
 * @param options - The environment variables.
 * @returns The dot environment code.
 */
export const toDotEnvironmentCode = (options: ToDotEnvironmentCodeOptions): string => {
  const { env } = options;
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

type CopyEnvFileOptions = {
  flavor: string;
  outputDir: string;
};

/**
 * Copies the environment file to the output directory.
 * @param options - The options for copying the env file.
 */
export const copyEnvFile = async (options: CopyEnvFileOptions): Promise<void> => {
  const { flavor, outputDir } = options;
  const envSourcePath = join(cwd(), `.env.${flavor}`);
  const envDestPath = join(outputDir, '.env');

  const sourceExists = await exists(envSourcePath);
  if (sourceExists) {
    await copyFile(envSourcePath, envDestPath);
  }
};
