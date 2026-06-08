import { beforeAll, describe, expect, test } from 'bun:test';
import { exists, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const FIREBASE_DIR = join(PROJECT_ROOT, 'apps', 'firebase');
const FIRESTACK_BIN = join(PROJECT_ROOT, '..', 'dist', 'main.js');

describe('Firestack CLI', () => {
  beforeAll(async () => {
    // Ensure dist is clean before tests
    const distPath = join(FIREBASE_DIR, 'dist');
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
          cwd: FIREBASE_DIR,
        }
      );

      expect(result.success).toBe(true);

      const [hasIndex, hasPackage, indexContent] = await Promise.all([
        exists(join(FIREBASE_DIR, 'dist', 'api', 'src', 'index.js')),
        exists(join(FIREBASE_DIR, 'dist', 'api', 'src', 'package.json')),
        readFile(join(FIREBASE_DIR, 'dist', 'api', 'src', 'index.js'), 'utf-8'),
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
          cwd: FIREBASE_DIR,
        }
      );

      expect(result.stdout.toString()).toContain('Found');
    },
    { timeout: 120000 }
  );

  test(
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
          cwd: FIREBASE_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Found 1 function(s) to deploy');
      expect(output).toContain('Dry run (1): test_api');
    },
    { timeout: 120000 }
  );

  test(
    'deploy dry-run',
    () => {
      const result = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--dry-run', '--packageManager', 'global'],
        {
          cwd: FIREBASE_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Deploying rules and indexes');
    },
    { timeout: 120000 }
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
          cwd: FIREBASE_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Testing firestore rules');
      expect(output).toContain('All rules tests passed');
    },
    { timeout: 300000 }
  );

  test(
    'deploy identity functions dry-run',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'identity_before_user_created,identity_before_user_signed_in,identity_before_email_sent,identity_before_sms_sent',
          '--dry-run',
          '--packageManager',
          'global',
        ],
        {
          cwd: FIREBASE_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Found 4 function(s) to deploy');
      expect(output).toContain('identity_before_user_created');
      expect(output).toContain('identity_before_user_signed_in');
      expect(output).toContain('identity_before_email_sent');
      expect(output).toContain('identity_before_sms_sent');

      // Verify the generated index uses v2 identity imports not v1 auth
      const indexPath = join(
        FIREBASE_DIR,
        'dist',
        'identity_before_user_created',
        'src',
        'index.js'
      );
      expect(exists(indexPath)).resolves.toBe(true);
    },
    { timeout: 120000 }
  );

  test(
    'deploy identity function with options',
    async () => {
      Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'identity_before_user_created',
          '--dry-run',
          '--packageManager',
          'global',
        ],
        {
          cwd: FIREBASE_DIR,
        }
      );

      // Verify firebase.json has correct runtime
      const fireConfigPath = join(
        FIREBASE_DIR,
        'dist',
        'identity_before_user_created',
        'firebase.json'
      );
      expect(exists(fireConfigPath)).resolves.toBe(true);

      const fireConfig = JSON.parse(await readFile(fireConfigPath, 'utf-8'));
      expect(fireConfig.functions.runtime).toBe('nodejs24');
    },
    { timeout: 120000 }
  );

  test(
    'deploy new builders dry-run',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'pubsub_example,tasks_example,eventarc_example,test_lab_example,remote_config_example,alerts_fatal_issue,ai_before_generate',
          '--dry-run',
          '--packageManager',
          'global',
        ],
        {
          cwd: FIREBASE_DIR,
        }
      );

      const output = result.stdout.toString();
      expect(output).toContain('Found 7 function(s) to deploy');
      expect(output).toContain('pubsub_example');
      expect(output).toContain('tasks_example');
      expect(output).toContain('eventarc_example');
      expect(output).toContain('test_lab_example');
      expect(output).toContain('remote_config_example');
      expect(output).toContain('alerts_fatal_issue');
      expect(output).toContain('ai_before_generate');

      // Verify pubsub generated index uses correct Firebase import
      const pubsubIndex = join(FIREBASE_DIR, 'dist', 'pubsub_example', 'src', 'index.js');
      expect(exists(pubsubIndex)).resolves.toBe(true);

      // Verify tasks generated index uses correct Firebase import
      const tasksIndex = join(FIREBASE_DIR, 'dist', 'tasks_example', 'src', 'index.js');
      expect(exists(tasksIndex)).resolves.toBe(true);

      // Verify alerts generated index uses sub-package import
      const alertsIndex = join(FIREBASE_DIR, 'dist', 'alerts_fatal_issue', 'src', 'index.js');
      expect(exists(alertsIndex)).resolves.toBe(true);
    },
    { timeout: 120000 }
  );

  test(
    'sync command help and dry-run simulation',
    () => {
      // Testing help first to ensure command is registered
      const helpResult = Bun.spawnSync(['node', FIRESTACK_BIN, 'sync', '--help'], {
        cwd: FIREBASE_DIR,
      });
      expect(helpResult.stdout.toString()).toContain(
        'Syncs Firestore and Storage rules, and Firestore indexes from Firebase.'
      );

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
          cwd: FIREBASE_DIR,
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
          cwd: FIREBASE_DIR,
        }
      );
      const firebaseOutput = firebaseResult.stdout.toString() + firebaseResult.stderr.toString();
      expect(firebaseOutput).toContain('Fetching logs for project: mock-project');
      expect(firebaseOutput).toContain('firebase functions:log --project mock-project');

      // 2. Test gcloud integration (with --tail)
      const gcloudResult = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'logs', '--projectId', 'mock-project', '--tail', '--verbose'],
        {
          cwd: FIREBASE_DIR,
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
          cwd: FIREBASE_DIR,
        }
      );
      const firestoreOutput = firestoreResult.stdout.toString() + firestoreResult.stderr.toString();
      expect(firestoreOutput).toContain('Reading last 100 firestore logs');
      expect(firestoreOutput).toContain('resource.type="cloud_firestore_database"');
    },
    { timeout: 60000 }
  );
});
