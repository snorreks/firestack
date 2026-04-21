import type { PackageManager } from './deploy.ts';
import type { FirebaseEmulator } from './emulators.ts';
import type { NodeVersion } from './helper-options.ts';

// TODO cleanup cli vs command options vs firestack config

export type BaseCliOptions = {
  flavor?: string;
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
  kill?: boolean;
  noKill?: boolean;
};

export type DeployCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  force?: boolean;
  only?: string;
  concurrency?: number;
  retryAmount?: number;
  isEmulator?: boolean;
  all?: boolean;
};

export type DeployCommandOptions = {
  flavor: string;
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
  all?: boolean;
  watch?: boolean;
  init?: boolean;
};

export type EmulateCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  only?: string;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  kill?: boolean;
  noKill?: boolean;
};

export type EmulateCommandOptions = {
  flavor: string;
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
  kill?: boolean;
};

export type LogsCliOptions = BaseCliOptions & {
  only?: string;
  lines?: string;
  since?: string;
  open?: boolean;
};

export type LogsCommandOptions = {
  flavor: string;
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
  since?: string;
  open?: boolean;
  firestoreRules?: string;
  storageRules?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
  watch?: boolean;
  noWatch?: boolean;
  init?: boolean;
  noInit?: boolean;
};

export type ScriptsCliOptions = BaseCliOptions;

export type ScriptsCommandOptions = {
  flavor: string;
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
};

export type DeleteCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  all?: boolean;
};

export type DeleteCommandOptions = {
  flavor: string;
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
};

export type RulesCliOptions = BaseCliOptions & {
  only?: string;
  force?: boolean;
};

export type RulesCommandOptions = {
  flavor: string;
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
};

export type BuildCommandOptions = {
  input: string;
  output: string;
  external?: string[];
  nodeVersion?: NodeVersion;
  minify?: boolean;
  sourcemap?: boolean;
};
