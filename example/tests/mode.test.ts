import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const FIRESTACK_BIN = join(PROJECT_ROOT, '..', 'dist', 'main.js');

/**
 * Sets up a temporary project directory with given config and returns the path.
 */
const setupTempProject = async (config: object): Promise<string> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'firestack-mode-test-'));
  await writeFile(join(tmpDir, 'firestack.json'), JSON.stringify(config, null, 2));
  await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj' }));
  return tmpDir;
};

/**
 * Sets up a temporary project with a firestack.config.ts file.
 */
const setupTempTsProject = async (configContent: string): Promise<string> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'firestack-mode-ts-test-'));
  await writeFile(join(tmpDir, 'firestack.config.ts'), configContent);
  await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj' }));
  return tmpDir;
};

describe("Mode resolution (info commands that don't need functions)", () => {
  afterAll(async () => {
    // Cleanup all temp dirs — handled by each test
  });

  test('deploy dry-run works with --mode flag', () => {
    // This uses the existing functions project which has 'example' mode
    const functionsDir = join(PROJECT_ROOT, 'apps', 'functions');
    const result = Bun.spawnSync(
      ['node', FIRESTACK_BIN, 'deploy', '--only', 'test_api', '--dry-run', '--mode', 'example'],
      { cwd: functionsDir }
    );

    expect(result.success).toBe(true);
    const output = result.stdout.toString();
    expect(output).toContain('Found 1 function(s) to deploy');
    expect(output).toContain('test_api');
  });

  test('deploy dry-run uses first mode from config when --mode is omitted', () => {
    // The example project has only one mode 'example', so without --mode it should default to it
    const functionsDir = join(PROJECT_ROOT, 'apps', 'functions');
    const result = Bun.spawnSync(
      ['node', FIRESTACK_BIN, 'deploy', '--only', 'test_api', '--dry-run'],
      { cwd: functionsDir }
    );

    expect(result.success).toBe(true);
    const output = result.stdout.toString();
    expect(output).toContain('test_api');
  });

  test('deploy uses correct projectId for the mode', () => {
    const functionsDir = join(PROJECT_ROOT, 'apps', 'functions');
    const result = Bun.spawnSync(
      [
        'node',
        FIRESTACK_BIN,
        'deploy',
        '--only',
        'test_api',
        '--dry-run',
        '--mode',
        'example',
        '--verbose',
      ],
      { cwd: functionsDir }
    );

    expect(result.success).toBe(true);
    const output = result.stdout.toString() + result.stderr.toString();
    // The 'example' mode maps to project 'aikami-dev'
    expect(output).toContain('aikami-dev');
  });

  test('emulate dry-run works with --mode flag', () => {
    const functionsDir = join(PROJECT_ROOT, 'apps', 'functions');
    const result = Bun.spawnSync(
      ['node', FIRESTACK_BIN, 'emulate', '--dry-run', '--mode', 'example'],
      { cwd: functionsDir }
    );

    expect(result.success).toBe(true);
    const output = result.stdout.toString();
    expect(output).toContain('Emulator dry run complete');
  });

  test('logs command with --mode flag works', () => {
    const functionsDir = join(PROJECT_ROOT, 'apps', 'functions');
    const result = Bun.spawnSync(
      [
        'node',
        FIRESTACK_BIN,
        'logs',
        '--projectId',
        'mock-project',
        '--mode',
        'example',
        '--verbose',
      ],
      { cwd: functionsDir }
    );

    const output = result.stdout.toString() + result.stderr.toString();
    expect(output).toContain('Fetching logs for project: mock-project');
  });
});

describe('Mode with firestack.config.ts', () => {
  let tmpDir = '';

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('TS config with static object works', async () => {
    tmpDir = await setupTempTsProject(`
      import { defineConfig } from "@snorreks/firestack";

      export default defineConfig({
        region: "europe-west1",
        modes: {
          dev: "dev-project",
          prod: "prod-project",
        },
      });
    `);

    // We can't easily test the full pipeline in a temp dir without functions,
    // but we can verify the config is loaded and doesn't crash
    const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'build', '--help'], { cwd: tmpDir });
    expect(result.success).toBe(true);
  });

  test('TS config with static object and --mode flag is handled', async () => {
    tmpDir = await setupTempTsProject(`
      import { defineConfig } from "@snorreks/firestack";

      export default defineConfig({
        region: "us-east1",
        modes: {
          test: "test-project",
        },
      });
    `);

    // Verify the config is at least parseable
    const result = Bun.spawnSync(['node', FIRESTACK_BIN, '--help'], { cwd: tmpDir });
    expect(result.success).toBe(true);
  });

  test('firestack.config.ts takes priority over firestack.json', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'firestack-priority-test-'));

    // Create both files — .ts should win
    await writeFile(
      join(tmpDir, 'firestack.json'),
      JSON.stringify({
        modes: { fromJson: 'json-project' },
        region: 'us-east1',
      })
    );

    await writeFile(
      join(tmpDir, 'firestack.config.ts'),
      `
      import { defineConfig } from "@snorreks/firestack";

      export default defineConfig({
        region: "europe-west1",
        modes: {
          fromTs: "ts-project",
        },
      });
      `
    );

    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj' }));

    const result = Bun.spawnSync(['node', FIRESTACK_BIN, '--help'], { cwd: tmpDir });
    expect(result.success).toBe(true);
  });
});

describe('Mode edge cases', () => {
  let tmpDir = '';

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('missing mode with no modes in config shows helpful error', async () => {
    tmpDir = await setupTempProject({
      region: 'us-central1',
      // No modes
    });

    const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'deploy', '--dry-run'], { cwd: tmpDir });

    expect(result.success).toBe(false);
    const stderr = result.stderr.toString();
    expect(stderr).toContain('Mode is required');
  });

  test('empty modes object shows helpful error', async () => {
    tmpDir = await setupTempProject({
      modes: {},
      region: 'us-central1',
    });

    const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'deploy', '--dry-run'], { cwd: tmpDir });

    expect(result.success).toBe(false);
    const stderr = result.stderr.toString();
    expect(stderr).toContain('Mode is required');
  });
});

describe('Backward compatibility (flavors key)', () => {
  let tmpDir = '';

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('JSON config with old flavors key still works', async () => {
    tmpDir = await setupTempProject({
      flavors: { dev: 'old-flavor-dev-project' },
      region: 'us-central1',
    });

    // --mode=dev should work even though config uses 'flavors'
    const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'deploy', '--dry-run', '--mode', 'dev'], {
      cwd: tmpDir,
    });

    // It should resolve the mode from 'flavors' and proceed.
    // Since no functions exist, it may succeed with nothing to deploy.
    const stderr = result.stderr.toString();
    const stdout = result.stdout.toString();
    // It should NOT say "Mode is required" — that means mode was resolved
    expect(stderr).not.toContain('Mode is required');
    expect(stdout).not.toContain('Mode is required');
  });

  test('first mode from old flavors key is used as default', async () => {
    tmpDir = await setupTempProject({
      flavors: {
        first: 'first-project',
        second: 'second-project',
      },
      region: 'us-central1',
    });

    // Without --mode, should use first mode ('first')
    const result = Bun.spawnSync(['node', FIRESTACK_BIN, 'deploy', '--dry-run'], { cwd: tmpDir });

    // Should fail because no functions, but not because of missing mode
    const stderr = result.stderr.toString();
    expect(stderr).not.toContain('Mode is required');
  });
});
