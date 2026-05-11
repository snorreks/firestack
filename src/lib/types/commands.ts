import type { PackageManager } from './deploy.ts';
import type { FirebaseEmulator } from './emulators.ts';
import type { NodeVersion } from './helper-options.ts';

// TODO cleanup cli vs command options vs firestack config

export type BaseCliOptions = {
  mode?: string;
  verbose?: boolean;
  silent?: boolean;
  projectId?: string;
  packageManager?: PackageManager;
  external?: string[];
  nodeVersion?: NodeVersion;
  debug?: boolean;
  minify?: boolean;
  noMinify?: boolean;
  sourcemap?: boolean;
  noSourcemap?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  region?: string;
  engine?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  force?: boolean;
  noForce?: boolean;
  cloudCacheFileName?: string;
  includeFilePath?: string;
  tsconfig?: string;
};

export type DeployCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  force?: boolean;
  only?: string;
  concurrency?: number;
  retryAmount?: number;
  isEmulator?: boolean;
  skipRules?: boolean;
};

export type DeployCommandOptions = {
  mode: string;
  functionsDirectory: string;
  rulesDirectory: string;
  scriptsDirectory: string;
  initScript: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  projectId?: string;
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  force?: boolean;
  only?: string;
  concurrency?: number;
  retryAmount?: number;
  firestoreRules?: string;
  storageRules?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  isEmulator?: boolean;
  skipRules?: boolean;
  watch?: boolean;
  init?: boolean;
  cloudCacheFileName: string;
  includeFilePath?: string;
  tsconfig?: string;
};

export type EmulateCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  only?: string;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  force?: boolean;
  noForce?: boolean;
};

export type EmulateCommandOptions = {
  mode: string;
  functionsDirectory: string;
  rulesDirectory: string;
  scriptsDirectory: string;
  initScript: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  projectId?: string;
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  emulators?: FirebaseEmulator[];
  keepNames?: boolean;
  force?: boolean;
  cloudCacheFileName: string;
  includeFilePath?: string;
  tsconfig?: string;
};

export type LogsCliOptions = BaseCliOptions & {
  only?: string;
  lines?: string;
  limit?: string;
  since?: string;
  open?: boolean;
  tail?: boolean;
  type?: 'functions' | 'firestore' | 'auth' | 'storage' | 'all';
};

export type LogsCommandOptions = {
  mode: string;
  functionsDirectory?: string;
  rulesDirectory?: string;
  scriptsDirectory?: string;
  initScript?: string;
  nodeVersion?: NodeVersion;
  region?: string;
  engine?: string;
  packageManager?: PackageManager;
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  projectId?: string;
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  only?: string;
  lines?: string;
  limit?: string;
  since?: string;
  open?: boolean;
  tail?: boolean;
  type?: 'functions' | 'firestore' | 'auth' | 'storage' | 'all';
  firestoreRules?: string;
  storageRules?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  cloudCacheFileName: string;
};

export type ScriptsCliOptions = BaseCliOptions;

export type ScriptsCommandOptions = {
  mode: string;
  scriptsDirectory: string;
  engine: string;
  functionsDirectory?: string;
  rulesDirectory?: string;
  initScript?: string;
  nodeVersion?: NodeVersion;
  region?: string;
  packageManager?: PackageManager;
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  projectId?: string;
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  firestoreRules?: string;
  storageRules?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  cloudCacheFileName: string;
};

export type DeleteCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  all?: boolean;
};

export type DeleteCommandOptions = {
  mode: string;
  projectId: string;
  functionsDirectory: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  all?: boolean;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  cloudCacheFileName: string;
};

export type RulesCliOptions = BaseCliOptions & {
  only?: string;
  force?: boolean;
};

export type SyncCliOptions = BaseCliOptions & {
  only?: string;
};

export type RulesCommandOptions = {
  mode: string;
  projectId: string;
  functionsDirectory: string;
  rulesDirectory: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  only?: string;
  force?: boolean;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  cloudCacheFileName: string;
};

export type SyncCommandOptions = {
  mode: string;
  projectId: string;
  functionsDirectory: string;
  rulesDirectory: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
  cloudCacheFileName: string;
};

export type BuildCommandOptions = {
  input: string;
  output: string;
  external?: string[];
  nodeVersion?: NodeVersion;
  minify?: boolean;
  sourcemap?: boolean;
  tsconfig?: string;
};

export type TestRulesCliOptions = BaseCliOptions & {
  watch?: boolean;
  coverage?: boolean;
  ci?: boolean;
  only?: string;
  timeout?: number;
};

export type TestRulesCommandOptions = {
  mode: string;
  projectId?: string;
  functionsDirectory: string;
  rulesDirectory: string;
  nodeVersion: NodeVersion;
  region: string;
  engine: string;
  packageManager: PackageManager;
  minify: boolean;
  sourcemap: boolean;
  external: string[];
  verbose?: boolean;
  silent?: boolean;
  debug?: boolean;
  watch?: boolean;
  coverage?: boolean;
  ci?: boolean;
  only?: string;
  timeout?: number;
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  cloudCacheFileName: string;
};
