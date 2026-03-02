import { copyFileSync, existsSync } from 'node:fs';

export function createFirebaseConfig(nodeVersion: string): string {
  const firebaseJsonContent = {
    functions: {
      source: 'src',
      runtime: `nodejs${nodeVersion}`,
    },
  };
  return JSON.stringify(firebaseJsonContent, null, 2);
}

export function createPackageJson(nodeVersion: string): string {
  const packageJsonContent = {
    type: 'module',
    main: 'index.js',
    engines: {
      node: nodeVersion,
    },
  };
  return JSON.stringify(packageJsonContent, null, 2);
}

export function toDotEnvironmentCode(environment: Record<string, string>): string {
  return Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export async function copyEnvFile(sourceDir: string, destDir: string): Promise<void> {
  const envSourcePath = `${sourceDir}/.env`;
  const envDestPath = `${destDir}/.env`;

  console.warn('🚨 WARNING: Copying .env file. This is NOT recommended for production!');
  console.warn('Consider using `firebase functions:config:set` for secrets.');
  try {
    if (existsSync(envSourcePath)) {
      copyFileSync(envSourcePath, envDestPath);
      console.log(`Copied .env file to ${destDir}`);
    }
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'ENOENT') {
      console.warn(`Could not find .env file at ${envSourcePath}, skipping copy.`);
    } else {
      throw error;
    }
  }
}
