import { readFile as readFileProm } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';
import { DEFAULT_NODE_VERSION } from '$constants';
import { logger } from '$logger';

async function readTextFile(path: string): Promise<string> {
  return readFileProm(path, 'utf-8');
}

export interface DeployOptions {
  flavor: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  only?: string;
  region?: string;
  concurrency?: number;
  retryAmount?: number;
  minify?: boolean;
  sourcemap?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  scriptsDirectory?: string;
  initScript?: string;
  projectId?: string;
  nodeVersion?: string;
  debug?: boolean;
}

export interface FirestackConfig {
  functionsDirectory?: string;
  rulesDirectory?: string;
  scriptsDirectory?: string;
  initScript?: string;
  flavors?: Record<string, string>;
  region?: string;
  nodeVersion?: string;
}

/**
 * Gets the deployment options by merging CLI options with the firestack.json configuration.
 * @param cliOptions The options provided via the command line.
 * @returns The merged deployment options.
 */
export async function getOptions(cliOptions: DeployOptions): Promise<DeployOptions> {
  const configPath = join(cwd(), 'firestack.json');
  let config: FirestackConfig = {};
  try {
    const configContent = await readTextFile(configPath);
    config = JSON.parse(configContent);
    logger.debug(`Using configuration from ${configPath}`);
  } catch (e) {
    const error = e as Error & { code?: string };
    if (error.code === 'ENOENT') {
      logger.debug('firestack.json not found, using command-line options.');
    } else {
      logger.error(`Failed to read firestack.json at ${configPath}: ${error.message}`);
      exit(1);
    }
  }

  const options: DeployOptions = {
    ...cliOptions,
    functionsDirectory:
      cliOptions.functionsDirectory || config.functionsDirectory || 'src/controllers',
    rulesDirectory: cliOptions.rulesDirectory || config.rulesDirectory || 'src/rules',
    scriptsDirectory: cliOptions.scriptsDirectory || config.scriptsDirectory || 'scripts',
    initScript: cliOptions.initScript || config.initScript || 'init.ts',
    region: cliOptions.region || config.region,
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || DEFAULT_NODE_VERSION,
    projectId: cliOptions.projectId || config.flavors?.[cliOptions.flavor],
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deployment...');
  logger.debug('Options:', options);

  return options;
}
