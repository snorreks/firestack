import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import type { DeployOptions } from '$commands/deploy/utils/options.js';
import { logger } from '$logger';

export interface RuleFile {
  name: string;
  type: 'firestore' | 'storage' | 'firestoreIndexes';
  path: string;
}

/**
 * Finds all rule files in the given rules directory.
 * @param rulesDirectory The directory to search for rule files.
 * @returns A list of rule files found.
 */
export async function findRuleFiles(rulesDirectory: string): Promise<RuleFile[]> {
  const rules: RuleFile[] = [];
  const rulesPath = join(cwd(), rulesDirectory);

  try {
    const entries = await readdir(rulesPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (name.startsWith('firestore.') && name.endsWith('.rules')) {
          rules.push({
            name: entry.name,
            type: 'firestore',
            path: join(rulesPath, entry.name),
          });
        } else if (name.startsWith('storage.') && name.endsWith('.rules')) {
          rules.push({
            name: entry.name,
            type: 'storage',
            path: join(rulesPath, entry.name),
          });
        } else if (name === 'firestore.indexes.json') {
          rules.push({
            name: entry.name,
            type: 'firestoreIndexes',
            path: join(rulesPath, entry.name),
          });
        }
      }
    }
  } catch {
    logger.debug(`Rules directory ${rulesPath} not found`);
  }

  return rules;
}

/**
 * Gets the list of rule files to deploy based on the given options.
 * @param options The deployment options.
 * @returns A list of rule files to deploy.
 */
export async function getRulesToDeploy(options: DeployOptions): Promise<RuleFile[]> {
  const rules = await findRuleFiles(options.rulesDirectory || 'src/rules');

  if (rules.length === 0) {
    logger.debug('No rule files found');
  } else {
    logger.info(`Found ${rules.length} rule file(s) to deploy`);
  }

  return rules;
}
