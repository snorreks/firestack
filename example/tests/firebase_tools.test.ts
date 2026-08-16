import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProjectFirebaseToolsPackageDir } from '../../src/lib/utils/firebase_tools.ts';

describe('resolveProjectFirebaseToolsPackageDir', () => {
  test('resolves a real firebase-tools package directory with the runtime file', async () => {
    const packageDir = await resolveProjectFirebaseToolsPackageDir();

    expect(packageDir).toBeDefined();
    // The repo root has firebase-tools as a devDependency, so walking up from
    // the example project must find a package dir whose runtime file exists.
    const runtimePath = join(
      packageDir as string,
      'lib',
      'deploy',
      'functions',
      'runtimes',
      'node',
      'index.js'
    );
    expect(existsSync(runtimePath)).toBe(true);
  });
});
