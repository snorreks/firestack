import { beforeAll, describe, expect, test } from 'bun:test';
import { exists, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const FUNCTIONS_DIR = join(PROJECT_ROOT, 'apps', 'functions');
const FIRESTACK_BIN = join(PROJECT_ROOT, '..', 'dist', 'main.js');

describe('Firestack CLI', () => {
  beforeAll(async () => {
    // Ensure dist is clean before tests
    const distPath = join(FUNCTIONS_DIR, 'dist');
    if (await exists(distPath)) {
      await rm(distPath, { recursive: true, force: true });
    }
  });

  test(
    'build command works',
    async () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'build',
          'src/controllers/api/test_api.ts',
          'dist/api/src/index.js',
          '--external',
          'firebase-admin,firebase-functions',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      expect(result.success).toBe(true);

      const [hasIndex, hasPackage, indexContent] = await Promise.all([
        exists(join(FUNCTIONS_DIR, 'dist', 'api', 'src', 'index.js')),
        exists(join(FUNCTIONS_DIR, 'dist', 'api', 'src', 'package.json')),
        readFile(join(FUNCTIONS_DIR, 'dist', 'api', 'src', 'index.js'), 'utf-8'),
      ]);

      expect(hasIndex).toBe(true);
      expect(hasPackage).toBe(true);
      expect(indexContent).toContain('test_api');
    },
    { timeout: 60000 }
  );

  test.concurrent(
    'rules command dry-run (finds files)',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'rules',
          '--only',
          'firestore',
          '--packageManager',
          'global',
          '--force',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      expect(result.stdout.toString()).toContain('Found');
    },
    { timeout: 60000 }
  );

  test.concurrent(
    'deploy command only test_api dry-run',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'test_api',
          '--dry-run',
          '--packageManager',
          'global',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Found 1 function(s) to deploy');
      expect(output).toContain('Dry run (1): test_api');
    },
    { timeout: 60000 }
  );

  test.concurrent(
    'deploy --all dry-run',
    () => {
      const result = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--all', '--dry-run', '--packageManager', 'global'],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Deploying all (rules and functions)');
    },
    { timeout: 60000 }
  );

  test(
    'test:rules command runs and discovers tests',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'test:rules',
          '--flavor',
          'example',
          '--only',
          'firestore',
          '--timeout',
          '120',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Testing firestore rules');
      expect(output).toContain('All rules tests passed');
    },
    { timeout: 300000 }
  );
});
