import { join } from 'node:path';
import { cwdDir, readTextFile } from '$utils/node-shim.js';

export async function getEnvironment(flavor: string): Promise<Record<string, string>> {
  const envPath = join(cwdDir(), `.env.${flavor}`);
  try {
    const envContent = await readTextFile(envPath);
    return envContent.split('\n').reduce(
      (acc, line) => {
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
        if (key && value && !key.startsWith('FIREBASE_SERVICE_ACCOUNT')) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}
