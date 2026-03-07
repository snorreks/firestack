import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { exists, getDependencyVersion } from '$utils/common.js';

/**
 * Creates a firebase.json file content.
 * @param nodeVersion The node version to use.
 * @returns The firebase.json content.
 */
export function createFirebaseConfig(nodeVersion: string): string {
  return JSON.stringify(
    {
      functions: {
        runtime: `nodejs${nodeVersion}`,
        source: 'src',
      },
    },
    null,
    2
  );
}

const getDependencies = async (options: {
  isEmulator?: boolean;
  external?: string[];
}): Promise<Record<string, string> | undefined> => {
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

/**
 * Creates a package.json file content.
 * @param options - The options for creating the package.json.
 * @returns The package.json content.
 */
export async function createPackageJson(options: {
  nodeVersion: string;
  external?: string[];
  functionName?: string;
  isEmulator?: boolean;
}): Promise<string> {
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
}

/**
 * Generates dot environment code.
 * @param env The environment variables.
 * @returns The dot environment code.
 */
export function toDotEnvironmentCode(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/**
 * Copies the environment file to the output directory.
 * @param flavor The flavor to copy.
 * @param outputDir The output directory.
 */
export async function copyEnvFile(flavor: string, outputDir: string): Promise<void> {
  const envSourcePath = join(cwd(), `.env.${flavor}`);
  const envDestPath = join(outputDir, '.env');

  if (await exists(envSourcePath)) {
    await copyFile(envSourcePath, envDestPath);
  }
}
