import type { PackageManager } from './deploy.ts';
import type { FirebaseEmulator } from './emulators.ts';
import type { NodeVersion } from './helper-options.ts';

export type RulesTestConfig = {
  rulesFile: string;
  testPattern: string;
  projectId?: string;
};

export type FirestackConfig = {
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  modes?: Record<string, string>;
  region?: string;
  nodeVersion?: NodeVersion;
  engine?: string;
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  packageManager?: PackageManager;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  init?: boolean;
  force?: boolean;
  cloudCacheFileName?: string;
  /**
   * Relative path to a file that will be auto-imported at the top of every
   * generated function index. Useful for initializing logging, OpenTelemetry,
   * or Sentry without boilerplate in each handler file.
   *
   * @default 'src/logger.ts'
   */
  includeFilePath?: string;
  rulesTests?: {
    firestore?: RulesTestConfig;
    storage?: RulesTestConfig;
  };
};

export type DefineConfigParams = {
  /**
   * The current mode (from --mode CLI flag).
   * When undefined, defaults to the first key in the `modes` config.
   */
  mode?: string;
};

/**
 * Helper function that provides full type safety for firestack.config.ts.
 *
 * Supports both a static config object and a callback factory that receives
 * the resolved mode (similar to SvelteKit's `defineConfig`).
 *
 * @example
 * ```ts
 * // Static config
 * export default defineConfig({
 *   region: 'us-central1',
 *   modes: { development: 'dev-project' },
 * });
 *
 * // Dynamic config with mode
 * export default defineConfig(({ mode }) => ({
 *   region: mode === 'production' ? 'us-east1' : 'us-central1',
 *   modes: {
 *     development: 'dev-project',
 *     production: 'prod-project',
 *   },
 * }));
 * ```
 */
export const defineConfig = (
  config: FirestackConfig | ((params: DefineConfigParams) => FirestackConfig)
): FirestackConfig | ((params: DefineConfigParams) => FirestackConfig) => {
  return config;
};
