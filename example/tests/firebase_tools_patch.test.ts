import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyFunctionsBinaryPatch } from '../../src/lib/utils/firebase_tools_patch.ts';

const ORIGINAL_BLOCK = `    findFunctionsBinary() {
        const sourceNodeModulesPath = path.join(this.sourceDir, "node_modules");
        const projectNodeModulesPath = path.join(this.projectDir, "node_modules");
        const sdkPath = require.resolve("firebase-functions", { paths: [this.sourceDir] });
        const sdkNodeModulesPath = sdkPath.substring(0, sdkPath.lastIndexOf("node_modules") + 12);
        const ignorePnpmModulesPath = sdkNodeModulesPath.replace(/\\/\\.pnpm\\/.*/, "");
        for (const nodeModulesPath of [
            sourceNodeModulesPath,
            projectNodeModulesPath,
            sdkNodeModulesPath,
            ignorePnpmModulesPath,
        ]) {
            const binPath = path.join(nodeModulesPath, ".bin", "firebase-functions");
            if ((0, fsutils_1.fileExistsSync)(binPath)) {
                logger_1.logger.debug(\`Found firebase-functions binary at '\${binPath}'\`);
                return binPath;
            }
        }
        throw new error_1.FirebaseError("Failed to find location of Firebase Functions SDK. " +
            "Please file a bug on Github (https://github.com/firebase/firebase-tools/).");
    }`;

describe('applyFunctionsBinaryPatch', () => {
  test('replaces the original findFunctionsBinary block with the Windows-aware variant', () => {
    const source = `class Delegate {\n${ORIGINAL_BLOCK}\n    spawnFunctionsProcess() {}\n}`;
    const patched = applyFunctionsBinaryPatch({ source });

    expect(patched).not.toBe(source);
    expect(patched).toContain('.exe');
    expect(patched).toContain('firebase-functions.exe');
    expect(patched).toContain('process.platform === "win32"');
    // Original search for the extensionless name is gone
    expect(patched).not.toContain('".bin", "firebase-functions");');
  });

  test('is idempotent — patched input returns unchanged', () => {
    const source = `class Delegate {\n${ORIGINAL_BLOCK}\n}`;
    const once = applyFunctionsBinaryPatch({ source });
    const twice = applyFunctionsBinaryPatch({ source: once });

    expect(twice).toBe(once);
    expect(twice).toContain('.exe');
  });

  test('leaves non-matching (unknown firebase-tools version) source untouched', () => {
    const source = 'class Delegate { findFunctionsBinary() { return "custom"; } }';
    expect(applyFunctionsBinaryPatch({ source })).toBe(source);
  });

  test('matches the firebase-tools version installed in this repo', async () => {
    const runtimePath = join(
      import.meta.dir,
      '..',
      '..',
      'node_modules',
      'firebase-tools',
      'lib',
      'deploy',
      'functions',
      'runtimes',
      'node',
      'index.js'
    );

    if (!existsSync(runtimePath)) {
      // firebase-tools is a devDependency of the root package — skip when absent
      return;
    }

    const source = await readFile(runtimePath, 'utf-8');
    const patched = applyFunctionsBinaryPatch({ source });

    expect(patched).not.toBe(source);
    expect(patched).toContain('firebase-functions.exe');
  });
});
