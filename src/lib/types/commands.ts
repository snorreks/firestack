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
};

export type DeployCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  force?: boolean;
  only?: string;
  region?: string;
  concurrency?: number;
  retryAmount?: number;
  minify?: boolean;
  sourcemap?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  engine?: string;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
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
};

export type EmulateCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  only?: string;
  firestoreRules?: string;
  storageRules?: string;
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  watch?: boolean;
  init?: boolean;
  open?: boolean;
  emulators?: FirebaseEmulator[];
  minify?: boolean;
  sourcemap?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  initScript?: string;
  scriptsDirectory?: string;
  region?: string;
  engine?: string;
  keepNames?: boolean;
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
};

export type LogsCliOptions = BaseCliOptions & {
  only?: string;
  lines?: string;
  since?: string;
  open?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  region?: string;
  engine?: string;
  minify?: boolean;
  sourcemap?: boolean;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
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
};

export type ScriptsCliOptions = BaseCliOptions & {
  scriptsDirectory?: string;
  engine?: string;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  initScript?: string;
  region?: string;
  minify?: boolean;
  sourcemap?: boolean;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
};

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
};

export type DeleteCliOptions = BaseCliOptions & {
  dryRun?: boolean;
  all?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  region?: string;
  engine?: string;
  minify?: boolean;
  sourcemap?: boolean;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
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
};

export type RulesCliOptions = BaseCliOptions & {
  only?: string;
  force?: boolean;
  functionsDirectory?: string;
  rulesDirectory?: string;
  firestoreRules?: string;
  storageRules?: string;
  scriptsDirectory?: string;
  initScript?: string;
  region?: string;
  engine?: string;
  minify?: boolean;
  sourcemap?: boolean;
  emulators?: FirebaseEmulator[];
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
  keepNames?: boolean;
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
};

export type BuildCommandOptions = {
  input: string;
  output: string;
  external?: string[];
  nodeVersion?: NodeVersion;
  minify?: boolean;
  sourcemap?: boolean;
};
