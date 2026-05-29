import { beforeAll, describe, expect, test } from 'bun:test';
import { exists, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const FIREBASE_DIR = join(PROJECT_ROOT, 'apps', 'firebase');
const FIRESTACK_BIN = join(PROJECT_ROOT, '..', 'dist', 'main.js');

describe('Firestack CLI Extended Tests', () => {
  beforeAll(async () => {
    // Ensure dist and tmp are clean before tests
    const distPath = join(FIREBASE_DIR, 'dist');
    const tmpPath = join(FIREBASE_DIR, 'tmp');
    if (await exists(distPath)) {
      await rm(distPath, { recursive: true, force: true });
    }
    if (await exists(tmpPath)) {
      await rm(tmpPath, { recursive: true, force: true });
    }
  });

  test(
    '1. .env file generation (only needed envs)',
    async () => {
      // Run deploy dry-run to trigger preparation of test_api
      // Use mode 'example' because it's in firestack config
      Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--only', 'test_api', '--dry-run', '--mode', 'example'],
        { cwd: FIREBASE_DIR }
      );

      const envPath = join(FIREBASE_DIR, 'dist', 'test_api', '.env');
      expect(await exists(envPath)).toBe(true);

      const envContent = await readFile(envPath, 'utf-8');
      // test_api.ts uses process.env.MODE
      expect(envContent).toContain('MODE=example');
      // .env.example has TEST_1 and TEST_2, they should NOT be here
      expect(envContent).not.toContain('TEST_1=');
      expect(envContent).not.toContain('TEST_2=');
    },
    { timeout: 120000 }
  );

  test(
    '2 & 4. external dependencies and functionName renaming',
    async () => {
      // auth/created.ts has functionName: 'auth_created_renamed' and external: ['is-thirteen']
      Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'auth_created_renamed',
          '--dry-run',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      const distDir = join(FIREBASE_DIR, 'dist', 'auth_created_renamed');
      expect(await exists(distDir)).toBe(true);

      const pkgJsonPath = join(distDir, 'package.json');
      expect(await exists(pkgJsonPath)).toBe(true);

      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
      expect(pkgJson.dependencies).toHaveProperty('is-thirteen');
    },
    { timeout: 120000 }
  );

  test(
    '3. assets work',
    async () => {
      // assets_test_api.ts has assets: ['src/assets/image.avif']
      Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'assets_test_api',
          '--dry-run',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      const assetPath = join(
        FIREBASE_DIR,
        'dist',
        'assets_test_api',
        'src',
        'src',
        'assets',
        'image.avif'
      );
      expect(await exists(assetPath)).toBe(true);
    },
    { timeout: 120000 }
  );

  test(
    '5. index.js export name matches renamed function',
    async () => {
      Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'auth_created_renamed',
          '--dry-run',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      const indexPath = join(FIREBASE_DIR, 'dist', 'auth_created_renamed', 'src', 'index.js');
      const indexContent = await readFile(indexPath, 'utf-8');

      // It should export the renamed function
      // In bundled esbuild it might be export{... as auth_created_renamed}
      expect(indexContent).toContain('auth_created_renamed');
    },
    { timeout: 120000 }
  );

  test(
    '6. nodeVersion override',
    async () => {
      // auth/created.ts has nodeVersion: '20'
      Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'deploy',
          '--only',
          'auth_created_renamed',
          '--dry-run',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      const pkgJsonPath = join(FIREBASE_DIR, 'dist', 'auth_created_renamed', 'package.json');
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
      expect(pkgJson.engines.node).toBe('20');

      const fireConfigPath = join(FIREBASE_DIR, 'dist', 'auth_created_renamed', 'firebase.json');
      const fireConfig = JSON.parse(await readFile(fireConfigPath, 'utf-8'));
      expect(fireConfig.functions.runtime).toBe('nodejs20');
    },
    { timeout: 120000 }
  );

  test(
    '7. other options in tmp',
    async () => {
      // scheduler/daily.ts
      Bun.spawnSync(
        ['node', FIRESTACK_BIN, 'deploy', '--only', 'daily', '--dry-run', '--mode', 'example'],
        { cwd: FIREBASE_DIR }
      );

      const tmpFile = join(FIREBASE_DIR, 'tmp', 'daily', 'daily.ts');
      expect(await exists(tmpFile)).toBe(true);

      const tmpContent = await readFile(tmpFile, 'utf-8');
      // daily.ts has schedule: 'every day 00:00'
      expect(tmpContent).toContain('"schedule": "every day 00:00"');
    },
    { timeout: 120000 }
  );

  test(
    '8. emulate --dry-run',
    async () => {
      const result = Bun.spawnSync(
        [
          'node',
          FIRESTACK_BIN,
          'emulate',
          '--dry-run',
          '--minify',
          '--sourcemap',
          '--mode',
          'example',
        ],
        { cwd: FIREBASE_DIR }
      );

      expect(result.stdout.toString()).toContain('Emulator dry run complete');

      const emulatorDist = join(FIREBASE_DIR, 'dist', 'emulator');
      expect(await exists(join(emulatorDist, 'firebase.json'))).toBe(true);
      expect(await exists(join(emulatorDist, 'src', 'index.js'))).toBe(true);
      expect(await exists(join(emulatorDist, '.env'))).toBe(true);

      const firebaseJson = JSON.parse(await readFile(join(emulatorDist, 'firebase.json'), 'utf-8'));
      expect(firebaseJson).toHaveProperty('emulators');
      expect(firebaseJson.emulators).toHaveProperty('functions');
      expect(firebaseJson.emulators).toHaveProperty('dataconnect');
      expect(firebaseJson.emulators.dataconnect).toHaveProperty('port', 9399);

      // Check dataconnect service config
      expect(firebaseJson).toHaveProperty('dataconnect');
      expect(firebaseJson.dataconnect).toHaveProperty('source', 'dataconnect');

      // Check dataconnect source directory was copied
      expect(await exists(join(emulatorDist, 'dataconnect', 'dataconnect.yaml'))).toBe(true);
      expect(await exists(join(emulatorDist, 'dataconnect', 'schema', 'schema.gql'))).toBe(true);
      expect(await exists(join(emulatorDist, 'dataconnect', 'connector', 'queries.gql'))).toBe(
        true
      );

      const envContent = await readFile(join(emulatorDist, '.env'), 'utf-8');
      expect(envContent).toContain('MODE=example');

      // Check rules and indexes are copied
      expect(await exists(join(emulatorDist, 'firestore.rules'))).toBe(true);
      expect(await exists(join(emulatorDist, 'firestore.indexes.json'))).toBe(true);
      expect(await exists(join(emulatorDist, 'storage.rules'))).toBe(true);

      expect(firebaseJson).toHaveProperty('firestore');
      expect(firebaseJson.firestore).toHaveProperty('rules', 'firestore.rules');
      expect(firebaseJson.firestore).toHaveProperty('indexes', 'firestore.indexes.json');
      expect(firebaseJson).toHaveProperty('storage');
      expect(firebaseJson.storage).toHaveProperty('rules', 'storage.rules');

      // Check index.js for exports
      const indexContent = await readFile(join(emulatorDist, 'src', 'index.js'), 'utf-8');
      const expectedExports = [
        'assets_test_api',
        'test_api',
        'auth_created_renamed',
        'test_callable',
        'users_created',
        'users_deleted',
        'users_updated',
        'daily',
        'archived',
        'deleted',
        'finalized',
        'updated',
      ];

      for (const exportName of expectedExports) {
        expect(indexContent).toContain(exportName);
      }
    },
    { timeout: 60000 }
  );
});
