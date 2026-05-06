import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { logger } from '$logger';
import type { DeployFunction, FunctionBuilder, FunctionOptions } from '$types';
import { extractDatabaseRef, extractDocumentPath } from '$utils/function_naming.ts';

type CreateIndexFileOptions = {
  functionName: string;
  functionPath: string;
  temporaryDirectory: string;
  functionsDirectoryPath: string;
  deployFunction: DeployFunction;
  functionOptions: FunctionOptions;
  /**
   * Relative path to a user file that should be imported at the top of the
   * generated index. Useful for initializing logging or telemetry.
   */
  includeFilePath?: string;
  /**
   * Absolute path to the project root. Required when includeFilePath is set
   * so the import can be resolved relative to the temporary directory.
   */
  projectRoot?: string;
};

export const createTemporaryIndexFunctionFile = async (
  options: CreateIndexFileOptions
): Promise<string> => {
  logger.debug('Creating temporary index file', options);

  const code = await toDeployIndexCode(options);

  const temporaryFilePath = join(options.temporaryDirectory, `${options.functionName}.ts`);

  await writeFile(temporaryFilePath, code, 'utf8');

  return temporaryFilePath;
};

export const toDeployIndexCode = async (options: CreateIndexFileOptions): Promise<string> => {
  const { deployFunction, functionPath, temporaryDirectory, includeFilePath, projectRoot } = options;

  const rootFunctionBuilder = toRootFunction(deployFunction);

  const importPath = `${relative(temporaryDirectory, functionPath)
    .replaceAll('\\', '/')
    .replace(/\.(ts|js)$/, '')}.ts`;

  const includeImportPath =
    includeFilePath && projectRoot
      ? `${relative(temporaryDirectory, join(projectRoot, includeFilePath))
          .replaceAll('\\', '/')
          .replace(/\.(ts|js)$/, '')}.ts`
      : undefined;

  if (rootFunctionBuilder === 'auth') {
    return toV1FunctionCode({
      ...options,
      importPath,
      includeImportPath,
    });
  }

  return toV2FunctionCode({
    ...options,
    importPath,
    includeImportPath,
    rootFunctionBuilder,
  });
};

const toV2FunctionCode = (
  options: CreateIndexFileOptions & {
    importPath: string;
    includeImportPath?: string;
    rootFunctionBuilder: FunctionBuilder;
  }
): string => {
  const {
    functionOptions,
    importPath,
    includeImportPath,
    functionName,
    deployFunction,
    rootFunctionBuilder,
    functionsDirectoryPath,
    functionPath,
  } = options;
  const functionCodeType = toFunctionCodeType(deployFunction);

  // Apply custom document/ref paths based on function type
  if (rootFunctionBuilder === 'firestore') {
    const documentPath = extractDocumentPath({ functionPath, functionsDirectoryPath });
    if (documentPath) {
      functionOptions.document = documentPath;
    }
  } else if (rootFunctionBuilder === 'database') {
    const refPath = extractDatabaseRef({ functionPath, functionsDirectoryPath });
    if (refPath) {
      functionOptions.ref = refPath;
    }
  }

  const optionsCode = JSON.stringify(functionOptions, null, 2);

  const includeImport = includeImportPath ? `import '${includeImportPath}';\n` : '';

  const fileCode = `
${includeImport}import { ${functionCodeType} } from 'firebase-functions/${rootFunctionBuilder}';
import functionStart from '${importPath}';

export const ${functionName} = ${functionCodeType}(${optionsCode}, functionStart);
`;
  return fileCode;
};

const toV1FunctionCode = (
  options: CreateIndexFileOptions & {
    importPath: string;
    includeImportPath?: string;
  }
): string => {
  const { functionOptions, importPath, includeImportPath, functionName, deployFunction } = options;
  const { region: regionOpt, ...runtimeOptions } = functionOptions;

  const region = regionOpt || 'us-central1';
  let chain = `region(${JSON.stringify(region)})`;

  if (Object.keys(runtimeOptions).length > 0) {
    chain += `.runWith(${JSON.stringify(runtimeOptions, null, 2)})`;
  }

  chain += '.auth';

  let trigger = '';
  switch (deployFunction) {
    case 'onAuthCreate':
      trigger = 'user().onCreate';
      break;
    case 'onAuthDelete':
      trigger = 'user().onDelete';
      break;
    case 'beforeAuthCreate':
      trigger = 'user().beforeCreate';
      break;
    case 'beforeAuthSignIn':
      trigger = 'user().beforeSignIn';
      break;
    default:
      throw new Error(`Invalid v1 function type: ${deployFunction}`);
  }

  const includeImport = includeImportPath ? `import '${includeImportPath}';\n` : '';

  return `
${includeImport}import { region } from 'firebase-functions/v1';
import functionStart from '${importPath}';

export const ${functionName} = ${chain}.${trigger}(functionStart);
`;
};

const toRootFunction = (deployFunction: DeployFunction): FunctionBuilder => {
  switch (deployFunction) {
    case 'onCreated':
    case 'onUpdated':
    case 'onDeleted':
    case 'onWritten':
    case 'onDocumentCreated':
    case 'onDocumentUpdated':
    case 'onDocumentDeleted':
    case 'onDocumentWritten':
    case 'onCreatedZod':
    case 'onUpdatedZod':
    case 'onDeletedZod':
    case 'onWrittenZod':
      return 'firestore';
    case 'onValueCreated':
    case 'onValueUpdated':
    case 'onValueDeleted':
    case 'onValueWritten':
      return 'database';
    case 'onCall':
    case 'onRequest':
    case 'onCallZod':
    case 'onRequestZod':
      return 'https';
    case 'onSchedule':
      return 'scheduler';
    case 'onObjectArchived':
    case 'onObjectDeleted':
    case 'onObjectFinalized':
    case 'onObjectMetadataUpdated':
      return 'storage';
    case 'onAuthDelete':
    case 'onAuthCreate':
    case 'beforeAuthCreate':
    case 'beforeAuthSignIn':
      return 'auth';
    default:
      throw new Error('Invalid function type');
  }
};

const toFunctionCodeType = (deployFunction: DeployFunction): string => {
  switch (deployFunction) {
    case 'onCall':
    case 'onCallZod':
      return 'onCall';
    case 'onRequest':
    case 'onRequestZod':
      return 'onRequest';
    case 'onCreated':
    case 'onCreatedZod':
    case 'onDocumentCreated':
      return 'onDocumentCreated';
    case 'onDeleted':
    case 'onDeletedZod':
    case 'onDocumentDeleted':
      return 'onDocumentDeleted';
    case 'onUpdated':
    case 'onUpdatedZod':
    case 'onDocumentUpdated':
      return 'onDocumentUpdated';
    case 'onWritten':
    case 'onWrittenZod':
    case 'onDocumentWritten':
      return 'onDocumentWritten';
    case 'onSchedule':
      return 'onSchedule';
    case 'onObjectArchived':
      return 'onObjectArchived';
    case 'onObjectDeleted':
      return 'onObjectDeleted';
    case 'onObjectFinalized':
      return 'onObjectFinalized';
    case 'onObjectMetadataUpdated':
      return 'onObjectMetadataUpdated';
    case 'onValueCreated':
      return 'onValueCreated';
    case 'onValueDeleted':
      return 'onValueDeleted';
    case 'onValueUpdated':
      return 'onValueUpdated';
    case 'onValueWritten':
      return 'onValueWritten';
    case 'onAuthCreate':
      return 'onCreate';
    case 'onAuthDelete':
      return 'onDelete';
    case 'beforeAuthCreate':
      return 'beforeCreate';
    case 'beforeAuthSignIn':
      return 'beforeSignIn';
    default:
      throw new Error(`Unknown function type: ${deployFunction}`);
  }
};
