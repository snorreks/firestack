import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { logger } from '$logger';
import type { DeployFunction, FunctionBuilder } from '$types';
import { extractDatabaseRef, extractDocumentPath } from '$utils/function_naming.js';
import { extractAndValidateOptions } from './parse_function_options.js'; // <-- Import new parser

export interface BuildFunctionData {
  functionName: string;
  funcPath: string;
  temporaryDirectory: string;
  controllersPath: string;
  region?: string;
}

export async function createTemporaryIndexFunctionFile(
  buildFunctionData: BuildFunctionData
): Promise<string> {
  logger.debug('Creating temporary index file', buildFunctionData);

  const code = await toDeployIndexCode(buildFunctionData);
  if (!code) {
    return buildFunctionData.funcPath;
  }

  const temporaryFilePath = join(
    buildFunctionData.temporaryDirectory,
    `${buildFunctionData.functionName}.ts`
  );

  await writeFile(temporaryFilePath, code, 'utf8');

  return temporaryFilePath;
}

async function toDeployIndexCode(
  buildFunctionData: BuildFunctionData
): Promise<string | undefined> {
  const { functionName, funcPath, temporaryDirectory, controllersPath, region } = buildFunctionData;

  const fileContent = await readFile(funcPath, 'utf8');

  // Hand off the heavy lifting to our new parser
  const { deployFunction, options } = extractAndValidateOptions(fileContent, funcPath, region);

  if (!deployFunction) {
    logger.debug(`No valid deploy function found in ${funcPath}`);
    return undefined;
  }

  const rootFunctionBuilder = toRootFunction(deployFunction);
  const functionCodeType = toFunctionCodeType(deployFunction);

  const importPath = `${relative(temporaryDirectory, funcPath)
    .replaceAll('\\', '/')
    .replace(/\.(ts|js)$/, '')}.ts`;

  // Apply custom document/ref paths based on function type
  if (rootFunctionBuilder === 'firestore') {
    const documentPath = extractDocumentPath({ funcPath, controllersPath });
    if (documentPath) {
      options.document = documentPath;
    }
  } else if (rootFunctionBuilder === 'database') {
    const refPath = extractDatabaseRef({ funcPath, controllersPath });
    if (refPath) {
      options.ref = refPath;
    }
  }

  const optionsCode = JSON.stringify(options, null, 2);

  if (rootFunctionBuilder === 'auth') {
    return toV1FunctionCode(functionName, importPath, deployFunction, options);
  }

  const fileCode = `
import { ${functionCodeType} } from 'firebase-functions/${rootFunctionBuilder}';
import functionStart from '${importPath}';

export const ${functionName} = ${functionCodeType}(${optionsCode}, functionStart);
`;
  return fileCode;
}
function toV1FunctionCode(
  functionName: string,
  importPath: string,
  deployFunction: DeployFunction,
  options: Record<string, unknown>
): string {
  const { region: regionOpt, ...runtimeOptions } = options;

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

  return `
import { region } from 'firebase-functions/v1';
import functionStart from '${importPath}';

export const ${functionName} = ${chain}.${trigger}(functionStart);
`;
}

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
      return 'firestore';
    case 'onValueCreated':
    case 'onValueUpdated':
    case 'onValueDeleted':
    case 'onValueWritten':
      return 'database';
    case 'onCall':
    case 'onRequest':
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
      return 'onCall';
    case 'onRequest':
      return 'onRequest';
    case 'onCreated':
    case 'onDocumentCreated':
      return 'onDocumentCreated';
    case 'onDeleted':
    case 'onDocumentDeleted':
      return 'onDocumentDeleted';
    case 'onUpdated':
    case 'onDocumentUpdated':
      return 'onDocumentUpdated';
    case 'onWritten':
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
