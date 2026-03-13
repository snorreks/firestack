import type { PackageManager } from './deploy.ts';
import type { NodeVersion } from './helper-options.ts';

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
  emulators?: string[];
  emulatorPorts?: Record<string, number>;
  keepNames?: boolean;
};
