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
  flavors?: Record<string, string>;
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
