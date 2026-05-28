import { beforeAll, describe, expect, test } from 'bun:test';
import { exists, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const FIREBASE_DIR = join(PROJECT_ROOT, 'apps', 'firebase');
const FIRESTACK_BIN = join(PROJECT_ROOT, '..', 'dist', 'main.js');

describe('Firestack Dataconnect', () => {
  beforeAll(async () => {
    // Clean dist before tests
    const distPath = join(FIREBASE_DIR, 'dist');
    if (await exists(distPath)) {
      await rm(distPath, { recursive: true, force: true });
    }
  });

  test(
    'dataconnect command exists and shows help',
    () => {
      const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'dataconnect', '--help'], {
        cwd: FIREBASE_DIR,
      });

      expect(result.success).toBe(true);
      const output = result.stdout.toString();
      expect(output).toContain('Deploys Firebase Data Connect');
      expect(output).toContain('--force');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--mode');
    },
    { timeout: 10000 }
  );

  test(
    'dataconnect dry-run detects files and generates config',
    async () => {
      const result = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'dataconnect', '--dry-run', '--mode', 'example', '--force'],
        { cwd: FIREBASE_DIR }
      );

      expect(result.success).toBe(true);
      const stdout = result.stdout.toString();
      expect(stdout).toContain('Dataconnect dry-run complete');

      // Verify the firebase.json was generated in a temp deploy directory
      const distDir = join(FIREBASE_DIR, 'dist');
      const entries = await import('node:fs/promises').then((fs) => fs.readdir(distDir));

      const deployDir = entries.find((e: string) => e.startsWith('dataconnect-deploy-'));
      expect(deployDir).toBeDefined();

      const firebaseJsonPath = join(distDir, deployDir, 'firebase.json');
      expect(await exists(firebaseJsonPath)).toBe(true);

      const firebaseJson = JSON.parse(await readFile(firebaseJsonPath, 'utf-8'));
      expect(firebaseJson).toHaveProperty('dataconnect');
      expect(firebaseJson.dataconnect).toHaveProperty('source', '../../dataconnect');
      expect(firebaseJson.dataconnect).toHaveProperty('location', 'us-central1');
      expect(firebaseJson.dataconnect).toHaveProperty('serviceId', 'firestack-example');
    },
    { timeout: 60000 }
  );

  test(
    'dataconnect skips when unchanged (checksum caching)',
    async () => {
      // First run with --force to establish cache
      const firstResult = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'dataconnect', '--dry-run', '--mode', 'example', '--force'],
        { cwd: FIREBASE_DIR }
      );
      expect(firstResult.success).toBe(true);

      // Second run without --force should skip
      const secondResult = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'dataconnect', '--dry-run', '--mode', 'example'],
        { cwd: FIREBASE_DIR }
      );
      expect(secondResult.success).toBe(true);
      const stdout = secondResult.stdout.toString();
      expect(stdout).toContain('No changes detected in dataconnect');
    },
    { timeout: 60000 }
  );

  test(
    'deploy --only dataconnect works',
    () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'dataconnect',
          '--dry-run',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      expect(result.success).toBe(true);
      const output = result.stdout.toString();
      expect(output).toContain('Deploying Data Connect');
    },
    { timeout: 60000 }
  );

  test(
    'deploy --skip-dataconnect skips dataconnect',
    () => {
      const result = Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--skip-dataconnect', '--dry-run', '--mode', 'example'],
        { cwd: FIREBASE_DIR }
      );

      expect(result.success).toBe(true);
      const output = result.stdout.toString();
      expect(output).not.toContain('Deploying Data Connect');
    },
    { timeout: 60000 }
  );
});
