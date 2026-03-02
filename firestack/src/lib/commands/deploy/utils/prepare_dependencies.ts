import { dirname, join } from 'node:path';
import { execa } from 'execa';
import { exitCode, mkdir, readTextFile, stat, writeTextFile } from '../../../node-shim.js';
import { logger } from '../../../utils/logger.js';

async function getDependencyVersions(cwd: string): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  let currentDir = cwd;

  while (currentDir !== dirname(currentDir)) {
    const packageJsonPath = join(currentDir, 'package.json');
    try {
      const content = await readTextFile(packageJsonPath);
      const json = JSON.parse(content);
      const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
      if (deps['firebase-admin'] && !versions['firebase-admin']) {
        versions['firebase-admin'] = deps['firebase-admin'];
      }
      if (deps['firebase-functions'] && !versions['firebase-functions']) {
        versions['firebase-functions'] = deps['firebase-functions'];
      }
      if (versions['firebase-admin'] && versions['firebase-functions']) {
        return versions;
      }
    } catch (error) {
      // Ignore if file doesn't exist
    }
    currentDir = dirname(currentDir);
  }
  return versions;
}

export async function prepareDependencies(cwd: string): Promise<void> {
  const dependenciesDir = join(cwd, 'tmp', 'dependencies');
  await mkdir(dependenciesDir, { recursive: true });

  const nodeModulesPath = join(dependenciesDir, 'node_modules');
  try {
    await stat(nodeModulesPath);
    logger.debug('Shared dependencies already exist, skipping installation.');
    return;
  } catch (error) {
    // Continue if not found
  }

  const versions = await getDependencyVersions(cwd);
  if (!versions['firebase-admin'] || !versions['firebase-functions']) {
    // Provide default versions if not found to avoid failing
    versions['firebase-admin'] = versions['firebase-admin'] || '^13.6.0';
    versions['firebase-functions'] = versions['firebase-functions'] || '^7.0.0';
  }

  const packageJsonContent = {
    dependencies: {
      'firebase-admin': versions['firebase-admin'],
      'firebase-functions': versions['firebase-functions'],
    },
  };

  await writeTextFile(
    join(dependenciesDir, 'package.json'),
    JSON.stringify(packageJsonContent, null, 2)
  );

  logger.info('Installing shared dependencies...');
  try {
    await execa('npm', ['install'], {
      cwd: dependenciesDir,
      stdio: 'inherit',
    });
  } catch (error: any) {
    logger.error('Failed to install shared dependencies:');
    logger.error(error.message);
    exitCode(1);
  }
  logger.info('Shared dependencies installed successfully.');
}
