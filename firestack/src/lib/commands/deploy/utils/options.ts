import { join } from 'node:path';
import { cwdDir, exitCode, readTextFile } from '../../../node-shim.js';
import { logger } from '../../../utils/logger.js';

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

export async function getOptions(cliOptions: DeployOptions): Promise<DeployOptions> {
  const configPath = join(cwdDir(), 'firestack.json');
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
      exitCode(1);
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
    nodeVersion: cliOptions.nodeVersion || config.nodeVersion || '20',
    projectId: cliOptions.projectId || config.flavors?.[cliOptions.flavor],
  };

  logger.setLogSeverity(options);
  logger.debug('Starting deployment...');
  logger.debug('Options:', options);

  return options;
}
