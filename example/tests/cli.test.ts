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
    'deploy dry-run',
    () => {
      const result = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--dry-run', '--packageManager', 'global'],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Deploying rules and indexes');
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
          '--mode',
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

  test(
    'sync command help and dry-run simulation',
    () => {
      // Testing help first to ensure command is registered
      const helpResult = Bun.spawnSync(['node', FIRESTACK_BIN, 'sync', '--help'], {
        cwd: FUNCTIONS_DIR,
      });
      expect(helpResult.stdout.toString()).toContain('Syncs Firestore, Storage rules, and indexes');

      // Running sync with a mock project ID to see it attempt execution
      // We use verbose to see the debug logs of what it's trying to do
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'sync',
          '--projectId',
          'mock-project',
          '--only',
          'firestore',
          '--verbose',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );

      const output = result.stdout.toString() + result.stderr.toString();
      expect(output).toContain('Fetching Firestore rules...');
      // Check that it TRIED to run the command, but don't be too strict about the exact bin path
      expect(output).toContain('firestore:rules:get');
      expect(output).toContain('--project mock-project');
    },
    { timeout: 60000 }
  );

  test(
    'logs command functionality',
    () => {
      // 1. Test standard firebase logs (default)
      const firebaseResult = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'logs', '--projectId', 'mock-project', '--verbose'],
        {
          cwd: FUNCTIONS_DIR,
        }
      );
      const firebaseOutput = firebaseResult.stdout.toString() + firebaseResult.stderr.toString();
      expect(firebaseOutput).toContain('Fetching logs for project: mock-project');
      expect(firebaseOutput).toContain('firebase functions:log --project mock-project');

      // 2. Test gcloud integration (with --tail)
      const gcloudResult = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'logs', '--projectId', 'mock-project', '--tail', '--verbose'],
        {
          cwd: FUNCTIONS_DIR,
        }
      );
      const gcloudOutput = gcloudResult.stdout.toString() + gcloudResult.stderr.toString();
      expect(gcloudOutput).toContain('Tailing functions logs for project: mock-project');
      expect(gcloudOutput).toContain('gcloud logging tail');

      // 3. Test different types (firestore)
      const firestoreResult = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'logs',
          '--projectId',
          'mock-project',
          '--type',
          'firestore',
          '--verbose',
        ],
        {
          cwd: FUNCTIONS_DIR,
        }
      );
      const firestoreOutput = firestoreResult.stdout.toString() + firestoreResult.stderr.toString();
      expect(firestoreOutput).toContain('Reading last 100 firestore logs');
      expect(firestoreOutput).toContain('resource.type="cloud_firestore_database"');
    },
    { timeout: 60000 }
  );
});
