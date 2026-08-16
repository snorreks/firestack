import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '$logger';

/**
 * The exact `findFunctionsBinary` implementation as published in
 * firebase-tools 15.23–15.27 (byte-identical across those versions, LF
 * line endings). The Windows patch replaces this block with a variant that
 * also searches .exe/.cmd shims and walks up from the source directory.
 */
const ORIGINAL_FIND_FUNCTIONS_BINARY = `    findFunctionsBinary() {
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

/**
 * Replacement for the original block. On Windows, bun's install layout only
 * creates .exe shims (no extensionless script) and Node cannot spawn an
 * extensionless file on Windows at all, so firebase-tools could never load
 * function definitions. Search .exe/.cmd variants per candidate directory,
 * then walk up from the source dir to find a bun .bin shim.
 */
const PATCHED_FIND_FUNCTIONS_BINARY = `    findFunctionsBinary() {
        const sourceNodeModulesPath = path.join(this.sourceDir, "node_modules");
        const projectNodeModulesPath = path.join(this.projectDir, "node_modules");
        const sdkPath = require.resolve("firebase-functions", { paths: [this.sourceDir] });
        const sdkNodeModulesPath = sdkPath.substring(0, sdkPath.lastIndexOf("node_modules") + 12);
        const ignorePnpmModulesPath = sdkNodeModulesPath.replace(/\\/\\.pnpm\\/.*/, "");

        // firestack: windows/bun findFunctionsBinary patch — extension variants
        // plus a walk-up for bun's .exe shims. bun only creates .exe/.cmd shims
        // (no extensionless script), and Node cannot spawn an extensionless file
        // on Windows. This is applied idempotently by firestack before spawning
        // firebase-tools; do not remove without re-patching on reinstall.
        const extensions = process.platform === "win32" ? ["", ".exe", ".cmd"] : [""];
        for (const nodeModulesPath of [
            sourceNodeModulesPath,
            projectNodeModulesPath,
            sdkNodeModulesPath,
            ignorePnpmModulesPath,
        ]) {
            for (const ext of extensions) {
                const binPath = path.join(nodeModulesPath, ".bin", \`firebase-functions\${ext}\`);
                if ((0, fsutils_1.fileExistsSync)(binPath)) {
                    logger_1.logger.debug(\`Found firebase-functions binary at '\${binPath}'\`);
                    return binPath;
                }
            }
        }
        if (process.platform === "win32") {
            let dir = path.resolve(this.sourceDir);
            while (true) {
                const binPath = path.join(dir, "node_modules", ".bin", "firebase-functions.exe");
                if ((0, fsutils_1.fileExistsSync)(binPath)) {
                    logger_1.logger.debug(\`Found firebase-functions binary at '\${binPath}'\`);
                    return binPath;
                }
                const parent = path.dirname(dir);
                if (parent === dir) {
                    break;
                }
                dir = parent;
            }
        }
        throw new error_1.FirebaseError("Failed to find location of Firebase Functions SDK. " +
            "Please file a bug on Github (https://github.com/firebase/firebase-tools/).");
    }`;

const PATCH_MARKER = 'firestack: windows/bun findFunctionsBinary patch';

type ApplyFunctionsBinaryPatchOptions = {
  source: string;
};

/**
 * Applies the Windows functions-binary patch to firebase-tools runtime source.
 * Pure string transform — no filesystem access, safe to unit test.
 * Idempotent: patched input comes back unchanged.
 * @param options - Contains the raw firebase-tools runtime source.
 * @returns The patched source, or the original source when the file was
 * already patched or does not match a known firebase-tools version.
 */
export const applyFunctionsBinaryPatch = (options: ApplyFunctionsBinaryPatchOptions): string => {
  const { source } = options;

  if (source.includes(PATCH_MARKER)) {
    return source;
  }

  if (!source.includes(ORIGINAL_FIND_FUNCTIONS_BINARY)) {
    return source;
  }

  return source.replace(ORIGINAL_FIND_FUNCTIONS_BINARY, PATCHED_FIND_FUNCTIONS_BINARY);
};

type EnsureFunctionsBinaryPatchOptions = {
  firebasePackageDir: string;
};

/**
 * Ensures the resolved firebase-tools instance carries the Windows
 * functions-binary patch, applying it idempotently when missing.
 *
 * Windows-only. Skips safely (never corrupts) when:
 * - the target file is missing or unreadable,
 * - the file does not match a known firebase-tools version (drift),
 * - the package lives in a pnpm store (hardlinks/symlinks into a shared
 *   store must never be rewritten).
 *
 * bun's install layout hardlinks/junctions packages into its cache; patching
 * through that link is intentional and idempotent — the patch only changes
 * behavior on Windows and survives reinstalls (firestack re-applies it on
 * every spawn when missing).
 * @param options - The resolved firebase-tools package directory.
 * @returns True when the patch was applied (or already present) on Windows.
 */
export const ensureFunctionsBinaryPatch = async (
  options: EnsureFunctionsBinaryPatchOptions
): Promise<boolean> => {
  const { firebasePackageDir } = options;

  if (process.platform !== 'win32') {
    return false;
  }

  const targetPath = join(
    firebasePackageDir,
    'lib',
    'deploy',
    'functions',
    'runtimes',
    'node',
    'index.js'
  );

  let source: string;
  try {
    source = await readFile(targetPath, 'utf-8');
  } catch (error) {
    logger.debug(`Skipping firebase-tools patch — cannot read ${targetPath}`, error);
    return false;
  }

  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const normalizedSource = lineEnding === '\n' ? source : source.replace(/\r\n/g, '\n');

  if (normalizedSource.includes(PATCH_MARKER)) {
    logger.debug(`firebase-tools functions binary patch already applied (${targetPath})`);
    return true;
  }

  const patchedSource = applyFunctionsBinaryPatch({ source: normalizedSource });
  if (patchedSource === normalizedSource) {
    logger.debug(
      `Skipping firebase-tools patch — unsupported firebase-tools version at ${targetPath}`
    );
    return false;
  }

  try {
    const resolvedPath = await realpath(targetPath);
    if (resolvedPath.includes('.pnpm')) {
      // pnpm hardlinks package files into a shared content-addressable store;
      // rewriting them would corrupt the store for every project. Not patching
      // is safe: pnpm's .bin shims are spawned via cross-spawn, which handles
      // the extensionless script, so discovery already works unpatched.
      logger.debug(
        `Skipping firebase-tools patch — ${targetPath} lives in a pnpm store (works unpatched)`
      );
      return false;
    }
  } catch (error) {
    logger.debug(`Skipping firebase-tools patch — cannot resolve ${targetPath}`, error);
    return false;
  }

  const finalSource = lineEnding === '\n' ? patchedSource : patchedSource.replace(/\n/g, '\r\n');

  try {
    await writeFile(targetPath, finalSource);
  } catch (error) {
    logger.warn(`Failed to patch firebase-tools functions binary at ${targetPath}`, error);
    return false;
  }

  logger.info(
    `Patched firebase-tools findFunctionsBinary for Windows function loading (${targetPath})`
  );
  return true;
};
