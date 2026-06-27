import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { cwd } from 'node:process';
import chalk from 'chalk';
import { logger } from '$logger';
import type {
  ChecksumData,
  DeployCommandOptions,
  DeployFunction,
  FirestackOptions,
  FunctionOptions,
  NodeVersion,
} from '$types';
import { buildFunction } from '$utils/build_utils.ts';
import { cacheChecksumLocal, checkForChanges } from '$utils/checksum.ts';
import { executeCommand } from '$utils/command.ts';
import { findProjectRoot } from '$utils/common.ts';
import {
  createFirebaseConfig,
  createPackageJson,
  toDotEnvironmentCode,
} from '$utils/firebase_utils.ts';
import { deriveFunctionName } from '$utils/function_naming.ts';
import { getEnvironmentNeeded } from '$utils/read-compiled-file.ts';
import { createTemporaryIndexFunctionFile } from './create_deploy_index.ts';
import type { FunctionMetadata } from './parse_function_metadata.ts';

export type ProcessResult = {
  functionName: string;
  status: 'deployed' | 'skipped' | 'failed' | 'dry-run';
  cleanupWarning?: string;
};

export type PrepareResult = {
  functionName: string;
  status: 'to-deploy' | 'skipped' | 'failed' | 'dry-run';
  deployFunctionData?: ChecksumData;
  outputDirectory?: string;
  temporaryDirectory?: string;
  metadata?: FunctionMetadata;
};

/**
 * Phase 1: Planning.
 * Builds the function and checks for changes.
 */
export const prepareFunction = async (options: {
  functionPath: string;
  deployOptions: DeployCommandOptions;
  environment: Record<string, string>;
  functionsDirectoryPath: string;
  metadata?: FunctionMetadata;
  cachedChecksums?: Record<string, string>;
}): Promise<PrepareResult> => {
  const { deployOptions, functionPath, environment, functionsDirectoryPath, metadata } = options;

  // Use functionName from firestackOptions if available, otherwise derive from path
  const functionName = metadata?.firestackOptions?.functionName ?? deriveFunctionName(options);

  // Use nodeVersion from firestackOptions if available
  let nodeVersion = metadata?.firestackOptions?.nodeVersion ?? deployOptions.nodeVersion;

  // Downgrade Node version for Auth triggers (GCF 1st Gen doesn't support Node 24)
  const relativePath = relative(functionsDirectoryPath, functionPath).replace(/\\/g, '/');
  const isAuthTrigger = relativePath.startsWith('auth/');

  if (isAuthTrigger && nodeVersion === '24') {
    logger.warn(
      chalk.yellow(
        `⚠️  Function '${functionName}' is an Auth trigger (GCF 1st Gen), which does not support Node.js 24. Downgrading to Node.js 22.`
      )
    );
    nodeVersion = '22';
  }

  const outputDirectory = join(cwd(), 'dist', functionName);
  const temporaryDirectory = join(cwd(), 'tmp', functionName);

  try {
    if (!nodeVersion) {
      throw new Error('Node version is required for deployment.');
    }

    // 1. Setup
    await setupDirectories({
      outputDirectory,
      temporaryDirectory,
      nodeVersion,
      functionName,
      deployOptions,
      firestackOptions: metadata?.firestackOptions,
    });

    if (!metadata) {
      throw new Error('Metadata is required for build.');
    }

    // 2. Build
    const buildSuccess = await performBuild({
      functionPath,
      functionName,
      outputDirectory,
      temporaryDirectory,
      functionsDirectoryPath,
      deployOptions,
      functionOptions: metadata.functionOptions ?? {},
      firestackOptions: metadata.firestackOptions,
      nodeVersion,
      deployFunction: metadata.deployFunction,
    });
    if (!buildSuccess) return { functionName, status: 'failed' };

    // 3. Env
    const environmentWithFunctionName = {
      ...environment,
      FIRESTACK_FUNCTION_NAME: functionName,
    };
    const envNeeded = await setupEnvironment({
      outputDirectory,
      environment: environmentWithFunctionName,
    });

    // 4. Check changes
    const deployFunctionData = await checkForChanges({
      functionName,
      outputRoot: outputDirectory,
      mode: deployOptions.mode || 'default',
      force: deployOptions.force,
      outputDirectory: join(cwd(), 'dist'),
      environment: envNeeded,
      cachedChecksums: options.cachedChecksums,
    });

    if (!deployFunctionData) {
      // Cleanup early if skipped
      if (!deployOptions.debug) {
        await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
      }
      return { functionName, status: 'skipped' };
    }

    if (deployOptions.dryRun) {
      return {
        functionName,
        status: 'dry-run',
        deployFunctionData,
        outputDirectory,
        temporaryDirectory,
        metadata,
      };
    }

    return {
      functionName,
      status: 'to-deploy',
      deployFunctionData,
      outputDirectory,
      temporaryDirectory,
      metadata,
    };
  } catch (error) {
    logger.error(`❌ Failed to prepare ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  }
};

/**
 * Phase 2: Execution.
 * Installs dependencies and deploys to Firebase.
 */
export const executeFunctionDeployment = async (options: {
  prepareResult: PrepareResult;
  deployOptions: DeployCommandOptions;
}): Promise<ProcessResult> => {
  const { prepareResult, deployOptions } = options;
  const { functionName, outputDirectory, temporaryDirectory, deployFunctionData, metadata } =
    prepareResult;

  if (!outputDirectory || !deployFunctionData) {
    return { functionName, status: 'failed' };
  }

  try {
    // 1. Clean node_modules to prevent ENOTDIR errors from corrupted nested deps
    const nodeModulesPath = join(outputDirectory, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      await rm(nodeModulesPath, { recursive: true, force: true });
    }

    // 2. Dependencies
    const installSuccess = await installDependencies({
      outputDirectory,
      deployOptions,
      firestackOptions: metadata?.firestackOptions,
    });
    if (!installSuccess) return { functionName, status: 'failed' };

    // 3. Deploy
    const deployResult = await deployAction({
      functionName,
      outputDirectory,
      deployOptions,
      metadata,
    });
    if (!deployResult.success) return { functionName, status: 'failed' };

    // 3. Cache
    await cacheChecksumLocal(deployFunctionData);
    return {
      functionName,
      status: 'deployed',
      cleanupWarning: deployResult.cleanupWarning,
    };
  } catch (error) {
    logger.error(`❌ Failed to deploy ${functionName}: ${(error as Error).message}`);
    return { functionName, status: 'failed' };
  } finally {
    if (!deployOptions.debug && temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }
};

const setupDirectories = async (options: {
  outputDirectory: string;
  temporaryDirectory: string;
  nodeVersion: NodeVersion;
  functionName: string;
  deployOptions: DeployCommandOptions;
  firestackOptions?: FirestackOptions;
}) => {
  const {
    outputDirectory,
    temporaryDirectory,
    nodeVersion,
    functionName,
    deployOptions,
    firestackOptions,
  } = options;

  await Promise.all([
    rm(outputDirectory, { recursive: true, force: true }),
    rm(temporaryDirectory, { recursive: true, force: true }),
  ]);

  await Promise.all([
    mkdir(join(outputDirectory, 'src'), { recursive: true }),
    mkdir(temporaryDirectory, { recursive: true }),
  ]);

  const [firebaseConfig, packageJson] = await Promise.all([
    Promise.resolve(createFirebaseConfig({ nodeVersion, functionName })),
    createPackageJson({
      nodeVersion,
      external: firestackOptions?.external ?? deployOptions.external,
      functionName,
      isEmulator: deployOptions.isEmulator,
      main: 'src/index.js',
      engine: deployOptions.engine,
    }),
  ]);

  await Promise.all([
    writeFile(join(outputDirectory, 'firebase.json'), firebaseConfig, 'utf-8'),
    writeFile(join(outputDirectory, 'package.json'), packageJson, 'utf-8'),
  ]);

  // Handle assets
  const assets = firestackOptions?.assets;
  if (assets && assets.length > 0) {
    const projectRoot = await findProjectRoot();
    await Promise.all(
      assets.map(async (asset) => {
        const sourcePath = join(projectRoot, asset);
        const destPath = join(outputDirectory, 'src', asset);
        await mkdir(dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
      })
    );
  }
};

const performBuild = async (options: {
  functionPath: string;
  functionName: string;
  outputDirectory: string;
  temporaryDirectory: string;
  functionsDirectoryPath: string;
  deployOptions: DeployCommandOptions;
  functionOptions: FunctionOptions;
  firestackOptions?: FirestackOptions;
  nodeVersion: NodeVersion;
  deployFunction: DeployFunction;
}): Promise<boolean> => {
  const {
    functionPath,
    functionName,
    outputDirectory,
    temporaryDirectory,
    functionsDirectoryPath,
    deployOptions,
    functionOptions,
    firestackOptions,
    nodeVersion,
    deployFunction,
  } = options;
  const outputFile = join(outputDirectory, 'src', 'index.js');

  try {
    const projectRoot = await findProjectRoot();
    const includeFileAbsolute = deployOptions.includeFilePath
      ? join(projectRoot, deployOptions.includeFilePath)
      : undefined;
    const includeFilePath =
      includeFileAbsolute && existsSync(includeFileAbsolute)
        ? deployOptions.includeFilePath
        : undefined;

    const inputFile = await createTemporaryIndexFunctionFile({
      functionPath,
      functionName,
      temporaryDirectory,
      functionOptions,
      functionsDirectoryPath,
      deployFunction,
      includeFilePath,
      projectRoot,
    });

    await buildFunction({
      inputFile,
      outputFile,
      configPath: join(projectRoot, 'package.json'),
      minify: deployOptions.minify,
      sourcemap: deployOptions.sourcemap,
      external: firestackOptions?.external ?? deployOptions.external,
      nodeVersion,
      keepNames: deployOptions.keepNames,
      tsconfig: deployOptions.tsconfig,
    });
    return true;
  } catch (buildError) {
    logger.error(`Failed to build ${functionName}: ${(buildError as Error).message}`);
    return false;
  }
};

const setupEnvironment = async (options: {
  outputDirectory: string;
  environment: Record<string, string>;
}) => {
  const { outputDirectory, environment } = options;
  const envNeeded = await getEnvironmentNeeded({ outputDirectory, environment });
  logger.debug(`Environment needed for ${outputDirectory}:`, envNeeded);
  if (envNeeded) {
    const envCode = toDotEnvironmentCode({ env: envNeeded });
    await writeFile(join(outputDirectory, '.env'), envCode, 'utf-8');
  }
  return envNeeded;
};

const installDependencies = async (options: {
  outputDirectory: string;
  deployOptions: DeployCommandOptions;
  firestackOptions?: FirestackOptions;
}): Promise<boolean> => {
  const { outputDirectory, deployOptions, firestackOptions } = options;
  const external = firestackOptions?.external ?? deployOptions.external;
  if (!external || external.length === 0) return true;

  const isBun = deployOptions.engine === 'bun';
  const result = await executeCommand(isBun ? 'bun' : 'npm', {
    args: ['install', '--legacy-peer-deps'],
    cwd: outputDirectory,
    packageManager: 'global',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (!result.success) {
    logger.error(`Failed to install dependencies for ${outputDirectory}:`);
    logger.error(result.stderr);
    return false;
  }
  return true;
};

// ── Gcloud deploy helpers ──────────────────────────────────────────────────

/** Trigger types that gcloud functions deploy can handle natively. */
const GCLOUD_SUPPORTED_TRIGGERS = new Set<DeployFunction>([
  'onCall',
  'onCallZod',
  'onRequest',
  'onRequestZod',
  'onCreated',
  'onCreatedZod',
  'onDocumentCreated',
  'onUpdated',
  'onUpdatedZod',
  'onDocumentUpdated',
  'onDeleted',
  'onDeletedZod',
  'onDocumentDeleted',
  'onWritten',
  'onWrittenZod',
  'onDocumentWritten',
  'onObjectArchived',
  'onObjectDeleted',
  'onObjectFinalized',
  'onObjectMetadataUpdated',
  'onMessagePublished',
  'onSchedule',
  'onTaskDispatched',
  'onValueCreated',
  'onValueDeleted',
  'onValueUpdated',
  'onValueWritten',
]);

/** Returns true when the trigger can be deployed via gcloud instead of firebase-tools. */
const isGcloudSupported = (deployFunction: DeployFunction): boolean => {
  return GCLOUD_SUPPORTED_TRIGGERS.has(deployFunction);
};

/** Builds a Firestore document path pattern for --trigger-event-filters-path-pattern. */
const buildFirestoreDocumentPattern = (functionOptions: FunctionOptions): string => {
  return (functionOptions.document as string) || '{document}';
};

/**
 * Builds a Firestore database filter for --trigger-event-filters.
 * Returns the database name (defaults to '(default)').
 */
const buildFirestoreDatabase = (functionOptions: FunctionOptions): string => {
  return (functionOptions.database as string) || '(default)';
};

/** Builds a Storage bucket name for --trigger-event-filters. */
const buildStorageBucket = (functionOptions: FunctionOptions): string => {
  return (functionOptions.bucket as string) || '';
};

/** Builds RTDB instance + ref path for trigger-event-filters. */
const buildDatabaseInstance = (functionOptions: FunctionOptions): string => {
  return (functionOptions.instance as string) || '';
};

const buildDatabaseRef = (functionOptions: FunctionOptions): string => {
  const ref = (functionOptions.ref as string) || 'ref';
  return ref.startsWith('/') ? ref : `/${ref}`;
};

/**
 * Builds the full gcloud functions deploy arguments for a given trigger type.
 * Returns the complete argument array (everything except the command name).
 */
const buildGcloudDeployArgs = (options: {
  functionName: string;
  outputDirectory: string;
  deployFunction: DeployFunction;
  functionOptions: FunctionOptions;
  projectId: string;
  region: string;
  nodeVersion: string;
}): string[] => {
  const {
    functionName,
    outputDirectory,
    deployFunction,
    functionOptions,
    projectId,
    region,
    nodeVersion,
  } = options;

  const args = [
    'functions',
    'deploy',
    functionName,
    '--source',
    outputDirectory,
    '--region',
    region,
    '--project',
    projectId,
    '--entry-point',
    functionName,
    '--runtime',
    `nodejs${nodeVersion}`,
    '--gen2',
  ];

  switch (deployFunction) {
    // ── HTTP / Callable ────────────────────────────────────────────
    case 'onCall':
    case 'onCallZod':
    case 'onRequest':
    case 'onRequestZod':
      args.push('--trigger-http', '--allow-unauthenticated');
      break;

    // ── Firestore ────────────────────────────────────────────────
    case 'onCreated':
    case 'onCreatedZod':
    case 'onDocumentCreated':
      args.push(
        `--trigger-event-filters=type=google.cloud.firestore.document.v1.created`,
        `--trigger-event-filters=database=${buildFirestoreDatabase(functionOptions)}`,
        `--trigger-event-filters-path-pattern=document=${buildFirestoreDocumentPattern(functionOptions)}`
      );
      break;
    case 'onUpdated':
    case 'onUpdatedZod':
    case 'onDocumentUpdated':
      args.push(
        `--trigger-event-filters=type=google.cloud.firestore.document.v1.updated`,
        `--trigger-event-filters=database=${buildFirestoreDatabase(functionOptions)}`,
        `--trigger-event-filters-path-pattern=document=${buildFirestoreDocumentPattern(functionOptions)}`
      );
      break;
    case 'onDeleted':
    case 'onDeletedZod':
    case 'onDocumentDeleted':
      args.push(
        `--trigger-event-filters=type=google.cloud.firestore.document.v1.deleted`,
        `--trigger-event-filters=database=${buildFirestoreDatabase(functionOptions)}`,
        `--trigger-event-filters-path-pattern=document=${buildFirestoreDocumentPattern(functionOptions)}`
      );
      break;
    case 'onWritten':
    case 'onWrittenZod':
    case 'onDocumentWritten':
      args.push(
        `--trigger-event-filters=type=google.cloud.firestore.document.v1.written`,
        `--trigger-event-filters=database=${buildFirestoreDatabase(functionOptions)}`,
        `--trigger-event-filters-path-pattern=document=${buildFirestoreDocumentPattern(functionOptions)}`
      );
      break;

    // ── Storage ──────────────────────────────────────────────────
    case 'onObjectArchived':
      args.push(
        '--trigger-event-filters=type=google.cloud.storage.object.v1.archived',
        `--trigger-event-filters=bucket=${buildStorageBucket(functionOptions)}`
      );
      break;
    case 'onObjectDeleted':
      args.push(
        '--trigger-event-filters=type=google.cloud.storage.object.v1.deleted',
        `--trigger-event-filters=bucket=${buildStorageBucket(functionOptions)}`
      );
      break;
    case 'onObjectFinalized':
      args.push(
        '--trigger-event-filters=type=google.cloud.storage.object.v1.finalized',
        `--trigger-event-filters=bucket=${buildStorageBucket(functionOptions)}`
      );
      break;
    case 'onObjectMetadataUpdated':
      args.push(
        '--trigger-event-filters=type=google.cloud.storage.object.v1.metadataUpdated',
        `--trigger-event-filters=bucket=${buildStorageBucket(functionOptions)}`
      );
      break;

    // ── PubSub ───────────────────────────────────────────────────
    case 'onMessagePublished': {
      const topic = functionOptions.topic;
      if (typeof topic !== 'string') {
        throw new Error('onMessagePublished requires a topic option');
      }
      args.push('--trigger-topic', topic);
      break;
    }

    // ── Scheduler & Tasks (HTTP-triggered with external orchestration)
    case 'onSchedule':
    case 'onTaskDispatched':
      args.push('--trigger-http');
      break;

    // ── Realtime Database ────────────────────────────────────────
    case 'onValueCreated':
      args.push(
        '--trigger-event-filters=type=google.firebase.database.ref.v1.created',
        `--trigger-event-filters-path-pattern=ref=${buildDatabaseRef(functionOptions)}`
      );
      if (buildDatabaseInstance(functionOptions)) {
        args.push(`--trigger-event-filters=instance=${buildDatabaseInstance(functionOptions)}`);
      }
      break;
    case 'onValueDeleted':
      args.push(
        '--trigger-event-filters=type=google.firebase.database.ref.v1.deleted',
        `--trigger-event-filters-path-pattern=ref=${buildDatabaseRef(functionOptions)}`
      );
      if (buildDatabaseInstance(functionOptions)) {
        args.push(`--trigger-event-filters=instance=${buildDatabaseInstance(functionOptions)}`);
      }
      break;
    case 'onValueUpdated':
      args.push(
        '--trigger-event-filters=type=google.firebase.database.ref.v1.updated',
        `--trigger-event-filters-path-pattern=ref=${buildDatabaseRef(functionOptions)}`
      );
      if (buildDatabaseInstance(functionOptions)) {
        args.push(`--trigger-event-filters=instance=${buildDatabaseInstance(functionOptions)}`);
      }
      break;
    case 'onValueWritten':
      args.push(
        '--trigger-event-filters=type=google.firebase.database.ref.v1.written',
        `--trigger-event-filters-path-pattern=ref=${buildDatabaseRef(functionOptions)}`
      );
      if (buildDatabaseInstance(functionOptions)) {
        args.push(`--trigger-event-filters=instance=${buildDatabaseInstance(functionOptions)}`);
      }
      break;
  }

  return args;
};

/**
 * Deploys a function using gcloud functions deploy.
 */
const deployViaGcloud = async (options: {
  functionName: string;
  outputDirectory: string;
  deployOptions: DeployCommandOptions;
  metadata: FunctionMetadata;
}): Promise<{ success: boolean; cleanupWarning?: string }> => {
  const { functionName, outputDirectory, deployOptions, metadata } = options;
  const { deployFunction, functionOptions, firestackOptions } = metadata;
  const nodeVersion = firestackOptions?.nodeVersion ?? deployOptions.nodeVersion;
  const region = deployOptions.region || 'europe-west3';

  const args = buildGcloudDeployArgs({
    functionName,
    outputDirectory,
    deployFunction,
    functionOptions,
    projectId: deployOptions.projectId || '',
    region,
    nodeVersion,
  });

  logger.debug(`gcloud ${args.join(' ')}`);

  try {
    const result = await executeCommand('gcloud', {
      args,
      packageManager: 'global',
    });

    if (result.success) {
      logger.info(chalk.dim(`Successfully deployed ${functionName} via gcloud.`));
      return { success: true };
    }

    logger.error(`❌ gcloud deploy failed for ${functionName}:`);
    logger.error(chalk.red(result.stderr || result.stdout));
    return { success: false };
  } catch (deployError) {
    logger.error(`Failed to deploy ${functionName} via gcloud: ${(deployError as Error).message}`);
    return { success: false };
  }
};

/**
 * Deploys a function using firebase-tools (fallback for unsupported trigger types).
 */
const deployViaFirebase = async (options: {
  functionName: string;
  outputDirectory: string;
  deployOptions: DeployCommandOptions;
}): Promise<{ success: boolean; cleanupWarning?: string }> => {
  const { functionName, outputDirectory, deployOptions } = options;
  const projectId = deployOptions.projectId || '';

  const deployArgs = [
    'deploy',
    '--config',
    'firebase.json',
    '--only',
    `functions:${functionName}`,
    '--project',
    projectId,
  ];
  if (deployOptions.force) {
    deployArgs.push('--force');
  }

  try {
    const result = await executeCommand('firebase', {
      args: deployArgs,
      cwd: outputDirectory,
      packageManager: deployOptions.packageManager,
    });

    if (result.success) {
      logger.info(chalk.dim(`Successfully deployed ${functionName}.`));
      return { success: true };
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const isCleanupFailure = combinedOutput.includes('could not set up cleanup policy');

    if (isCleanupFailure) {
      logger.warn(
        chalk.yellow(
          `⚠️  ${functionName} deployed successfully, but cleanup policy could not be set up.`
        )
      );
      return { success: true, cleanupWarning: combinedOutput.trim() };
    }

    // Always surface the full firebase-tools output on failure
    logger.error(`❌ Failed to deploy ${functionName}.`);
    if (result.stderr) {
      logger.error(chalk.red(`firebase-tools stderr:\n${result.stderr}`));
    }
    if (result.stdout) {
      logger.error(chalk.dim(`firebase-tools stdout:\n${result.stdout}`));
    }
    return { success: false };
  } catch (deployError) {
    logger.error(`Failed to deploy ${functionName}: ${(deployError as Error).message}`);
    return { success: false };
  }
};

const deployAction = async (options: {
  functionName: string;
  outputDirectory: string;
  deployOptions: DeployCommandOptions;
  metadata?: FunctionMetadata;
}): Promise<{ success: boolean; cleanupWarning?: string }> => {
  const { functionName, outputDirectory, deployOptions, metadata } = options;
  if (!deployOptions.projectId) throw new Error('Project ID is required.');

  const useGcloud =
    (deployOptions.deployEngine ?? 'firebase-tools') === 'gcloud' &&
    metadata?.deployFunction &&
    isGcloudSupported(metadata.deployFunction);

  if (useGcloud && metadata) {
    return deployViaGcloud({ functionName, outputDirectory, deployOptions, metadata });
  }

  return deployViaFirebase({ functionName, outputDirectory, deployOptions });
};
