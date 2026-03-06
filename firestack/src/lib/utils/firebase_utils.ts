import { copyFileSync, existsSync } from 'node:fs';
import { logger } from '$logger';

/**
 * Creates a firebase.json configuration string.
 * @param nodeVersion - The Node.js version to use.
 * @returns A JSON string for the firebase.json configuration.
 */
export function createFirebaseConfig(nodeVersion: string): string {
  const firebaseJsonContent = {
    functions: {
      source: 'src',
      runtime: `nodejs${nodeVersion}`,
    },
  };
  return JSON.stringify(firebaseJsonContent, null, 2);
}

/**
 * Creates a package.json configuration string for functions.
 * @param nodeVersion - The Node.js version to use.
 * @param external - An optional array of external dependencies.
 * @returns A JSON string for the package.json configuration.
 */
export function createPackageJson(nodeVersion: string, external?: string[]): string {
  const packageJsonContent: Record<string, any> = {
    type: 'module',
    main: 'index.js',
    engines: {
      node: nodeVersion,
    },
    dependencies: {
      'firebase-admin': '*',
      'firebase-functions': '*',
    },
  };

  if (external && external.length > 0) {
    external.forEach((dep) => {
      packageJsonContent.dependencies[dep] = 'latest';
    });
  }

  return JSON.stringify(packageJsonContent, null, 2);
}

/**
 * Converts an environment record to a .env formatted string.
 * @param environment - A record of environment variables.
 * @returns A string formatted for a .env file.
 */
export function toDotEnvironmentCode(environment: Record<string, string>): string {
  return Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/**
 * Copies a .env file from a source directory to a destination directory.
 * @param sourceDir - The source directory.
 * @param destDir - The destination directory.
 * @returns A promise that resolves when the copy is complete.
 */
export async function copyEnvFile(sourceDir: string, destDir: string): Promise<void> {
  const envSourcePath = `${sourceDir}/.env`;
  const envDestPath = `${destDir}/.env`;

  logger.warn('🚨 WARNING: Copying .env file. This is NOT recommended for production!');
  logger.warn('Consider using `firebase functions:config:set` for secrets.');
  try {
    if (existsSync(envSourcePath)) {
      copyFileSync(envSourcePath, envDestPath);
      logger.info(`Copied .env file to ${destDir}`);
    }
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'ENOENT') {
      logger.warn(`Could not find .env file at ${envSourcePath}, skipping copy.`);
    } else {
      throw error;
    }
  }
}
