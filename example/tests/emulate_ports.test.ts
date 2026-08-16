import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveEnabledEmulators } from '../../src/lib/commands/emulate/index.ts';
import type { EmulateCommandOptions, FirebaseEmulator } from '../../src/lib/types/index.ts';
import { getBaseOptions } from '../../src/lib/utils/options.ts';
import {
  defaultPorts,
  resolveCleanupPorts,
  resolveEmulatorPort,
  resolveHubPort,
} from '../../src/lib/utils/ports.ts';

const PORT_ENV_KEYS = [
  'FIRESTACK_EMULATOR_UI_PORT',
  'FIRESTACK_EMULATOR_HUB_PORT',
  'FIRESTACK_EMULATOR_AUTH_PORT',
  'FIRESTACK_EMULATOR_FUNCTIONS_PORT',
  'FIRESTACK_EMULATOR_FIRESTORE_PORT',
  'FIRESTACK_EMULATOR_PUBSUB_PORT',
  'FIRESTACK_EMULATOR_STORAGE_PORT',
  'FIRESTACK_EMULATOR_DATABASE_PORT',
  'FIRESTACK_EMULATOR_HOSTING_PORT',
  'FIRESTACK_EMULATOR_DATACONNECT_PORT',
] as const;

const clearPortEnv = (): void => {
  for (const key of PORT_ENV_KEYS) {
    delete process.env[key];
  }
};

/**
 * Builds a minimal EmulateCommandOptions object with the given fields.
 */
const makeEmulateOptions = (overrides: {
  emulators?: string[];
  emulatorPorts?: Partial<Record<string, number>>;
  rulesDirectory?: string;
  dataconnectDirectory?: string;
}): EmulateCommandOptions => {
  return {
    mode: 'dev',
    functionsDirectory: 'src/controllers',
    rulesDirectory: overrides.rulesDirectory ?? 'src/rules',
    scriptsDirectory: 'scripts',
    initScript: 'on_emulate.ts',
    nodeVersion: '24',
    region: 'us-central1',
    engine: 'bun',
    packageManager: 'global',
    minify: false,
    sourcemap: false,
    external: [],
    watch: false,
    init: true,
    force: false,
    cloudCacheFileName: 'functions-cache.ts',
    includeFilePath: 'src/logger.ts',
    dataconnectDirectory: overrides.dataconnectDirectory ?? 'dataconnect',
    ...(overrides.emulators
      ? { emulators: overrides.emulators as EmulateCommandOptions['emulators'] }
      : {}),
    ...(overrides.emulatorPorts
      ? {
          emulatorPorts: overrides.emulatorPorts as EmulateCommandOptions['emulatorPorts'],
        }
      : {}),
  };
};

describe('resolveEmulatorPort', () => {
  afterEach(clearPortEnv);

  test('falls back to the firebase-tools default port', () => {
    expect(resolveEmulatorPort({ emulatorName: 'auth', emulatorPorts: undefined })).toBe(9099);
    expect(resolveEmulatorPort({ emulatorName: 'hub', emulatorPorts: undefined })).toBe(4400);
    expect(resolveEmulatorPort({ emulatorName: 'ui', emulatorPorts: undefined })).toBe(4000);
  });

  test('uses the explicit emulatorPorts config when no env override is set', () => {
    const emulatorPorts = { auth: 9199, hub: 4401, ui: 4001 } as Partial<Record<string, number>>;
    expect(resolveEmulatorPort({ emulatorName: 'auth', emulatorPorts })).toBe(9199);
    expect(resolveEmulatorPort({ emulatorName: 'hub', emulatorPorts })).toBe(4401);
  });

  test('env override beats the explicit config', () => {
    process.env.FIRESTACK_EMULATOR_AUTH_PORT = '9299';
    const emulatorPorts = { auth: 9199 } as Partial<Record<string, number>>;
    expect(resolveEmulatorPort({ emulatorName: 'auth', emulatorPorts })).toBe(9299);
  });

  test('invalid env values are ignored', () => {
    process.env.FIRESTACK_EMULATOR_AUTH_PORT = 'not-a-port';
    expect(resolveEmulatorPort({ emulatorName: 'auth', emulatorPorts: undefined })).toBe(9099);
  });

  test('emulators without a default port resolve to undefined', () => {
    expect(resolveEmulatorPort({ emulatorName: 'eventarc', emulatorPorts: undefined })).toBe(
      undefined
    );
  });
});

describe('resolveHubPort', () => {
  afterEach(clearPortEnv);

  test('env override wins', () => {
    process.env.FIRESTACK_EMULATOR_HUB_PORT = '4402';
    expect(resolveHubPort({ emulatorPorts: { hub: 4401 } })).toBe(4402);
  });

  test('legacy emulatorHub alias is honored', () => {
    expect(resolveHubPort({ emulatorPorts: { emulatorHub: 4403 } })).toBe(4403);
  });

  test('defaults to 4400', () => {
    expect(resolveHubPort({ emulatorPorts: undefined })).toBe(4400);
  });
});

describe('resolveEnabledEmulators', () => {
  test('returns the explicit list as-is', async () => {
    const emulateOptions = makeEmulateOptions({ emulators: ['auth', 'firestore'] });
    const result = await resolveEnabledEmulators({
      emulateOptions,
      functionFiles: ['src/controllers/example.ts'],
    });
    expect([...result].sort()).toEqual(['auth', 'firestore']);
  });

  test('auto-detects functions + auth + firestore + storage rules', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'firestack-enabled-emulators-'));
    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await mkdir(join(tmpDir, 'src', 'rules'), { recursive: true });
      await writeFile(join(tmpDir, 'src', 'rules', 'firestore.rules'), "rules_version = '2';");
      await writeFile(join(tmpDir, 'src', 'rules', 'storage.rules'), "rules_version = '2';");

      const emulateOptions = makeEmulateOptions({});
      const result = await resolveEnabledEmulators({
        emulateOptions,
        functionFiles: ['src/controllers/example.ts'],
      });
      expect([...result].sort()).toEqual(['auth', 'firestore', 'functions', 'storage']);
    } finally {
      process.chdir(previousCwd);
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('does not enable emulators when there are no functions or rules', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'firestack-enabled-empty-'));
    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const emulateOptions = makeEmulateOptions({});
      const result = await resolveEnabledEmulators({
        emulateOptions,
        functionFiles: [],
      });
      expect(result.size).toBe(0);
    } finally {
      process.chdir(previousCwd);
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('resolveCleanupPorts', () => {
  afterEach(clearPortEnv);

  test('only frees ports for enabled emulators plus ui and hub', () => {
    // A suite that only runs auth must NOT kill the default ports of
    // emulators it does not run (firestore 8080, storage 9199, functions
    // 5001, ...) — another suite may own those.
    const ports = resolveCleanupPorts({
      enabledEmulators: new Set<FirebaseEmulator>(['auth']),
      emulatorPorts: undefined,
    });
    expect(ports).toEqual([defaultPorts.ui, defaultPorts.auth, defaultPorts.hub]);
  });

  test('uses offset ports from the config for every enabled emulator', () => {
    const ports = resolveCleanupPorts({
      enabledEmulators: new Set<FirebaseEmulator>(['auth', 'firestore']),
      emulatorPorts: { auth: 9199, firestore: 8180, ui: 4001, hub: 4401 },
    });
    expect(ports).toEqual([4001, 9199, 8180, 4401]);
  });

  test('env overrides flow into the cleanup list', () => {
    process.env.FIRESTACK_EMULATOR_AUTH_PORT = '9299';
    const ports = resolveCleanupPorts({
      enabledEmulators: new Set<FirebaseEmulator>(['auth']),
      emulatorPorts: { auth: 9199 },
    });
    expect(ports).toContain(9299);
  });

  test('drops emulators without a resolvable port', () => {
    const ports = resolveCleanupPorts({
      enabledEmulators: new Set<FirebaseEmulator>(['eventarc']),
      emulatorPorts: undefined,
    });
    expect(ports).toEqual([defaultPorts.ui, defaultPorts.hub]);
  });
});

describe('mode-aware config resolution', () => {
  let tmpDir = '';
  const previousCwd = process.cwd();

  afterEach(async () => {
    process.chdir(previousCwd);
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('defineConfig(({ mode }) => ...) branches apply per mode', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'firestack-mode-aware-'));
    await writeFile(
      join(tmpDir, 'firestack.config.ts'),
      `
      export default ({ mode }: { mode?: string }) => ({
        modes: { manual: 'demo-manual', contract: 'demo-contract' },
        emulatorPorts:
          mode === 'contract'
            ? { auth: 9199, hub: 4401, ui: 4001 }
            : { auth: 9099, hub: 4400, ui: 4000 },
      });
      `
    );

    process.chdir(tmpDir);

    const manual = await getBaseOptions({ mode: 'manual' });
    expect(manual.projectId).toBe('demo-manual');
    expect(manual.emulatorPorts).toEqual({ auth: 9099, hub: 4400, ui: 4000 });

    const contract = await getBaseOptions({ mode: 'contract' });
    expect(contract.projectId).toBe('demo-contract');
    expect(contract.emulatorPorts).toEqual({ auth: 9199, hub: 4401, ui: 4001 });
  });

  test('static TS configs still resolve with defaults', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'firestack-mode-static-'));
    await writeFile(
      join(tmpDir, 'firestack.config.ts'),
      `
      export default {
        modes: { dev: 'demo-static' },
        region: 'europe-west1',
      };
      `
    );

    process.chdir(tmpDir);

    const options = await getBaseOptions({ mode: 'dev' });
    expect(options.projectId).toBe('demo-static');
    expect(options.region).toBe('europe-west1');
  });
});
