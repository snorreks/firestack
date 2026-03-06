import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { exists } from '$utils/common.js';

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

/**
 * Creates a package.json file content.
 * @param nodeVersion The node version to use.
 * @param external The external dependencies to include.
 * @returns The package.json content.
 */
export function createPackageJson(nodeVersion: string, external: string[] = []): string {
  const dependencies: Record<string, string> = {
    'firebase-admin': '^13.0.0',
    'firebase-functions': '^7.0.0',
  };

  for (const ext of external) {
    dependencies[ext] = '*';
  }

  return JSON.stringify(
    {
      name: 'functions',
      type: 'module',
      main: 'index.js',
      engines: {
        node: nodeVersion,
      },
      dependencies,
    },
    null,
    2
  );
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
