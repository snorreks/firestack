import { join, relative } from 'node:path';
import {
  createSourceFile,
  type Expression,
  forEachChild,
  isCallExpression,
  isExportAssignment,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  type ObjectLiteralExpression,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';
import { functions } from '../../../constants/function-types.js';
import { readTextFile, writeTextFile } from '../../../node-shim.js';
import type { DeployFunction, FunctionBuilder } from '../../../types/index.js';
import { extractDatabaseRef, extractDocumentPath } from '../../../utils/function_naming.js';
import { logger } from '../../../utils/logger.js';

interface BuildFunctionData {
  functionName: string;
  funcPath: string;
  temporaryDirectory: string;
  controllersPath: string;
}

export async function createTemporaryIndexFunctionFile(
  buildFunctionData: BuildFunctionData
): Promise<string> {
  logger.debug('Creating temporary index file', buildFunctionData);

  const code = await toDeployIndexCode(buildFunctionData);
  if (!code) {
    // Not all files are functions, so we return the original path
    return buildFunctionData.funcPath;
  }

  const temporaryFilePath = getTemporaryFilePath(
    buildFunctionData.temporaryDirectory,
    buildFunctionData.functionName
  );

  await writeTextFile(temporaryFilePath, code);

  return temporaryFilePath;
}

const getTemporaryFilePath = (temporaryDirectory: string, functionName: string) =>
  join(temporaryDirectory, `${functionName}.ts`);

async function toDeployIndexCode(
  buildFunctionData: BuildFunctionData
): Promise<string | undefined> {
  const { functionName, funcPath, temporaryDirectory } = buildFunctionData;

  const fileContent = await readTextFile(funcPath);
  const sourceFile = createSourceFile(funcPath, fileContent, ScriptTarget.ESNext, true);

  let deployFunction: DeployFunction | undefined;
  let options: Record<string, unknown> = {};

  forEachChild(sourceFile, (node) => {
    if (
      isExportAssignment(node) &&
      isCallExpression(node.expression) &&
      isIdentifier(node.expression.expression)
    ) {
      const escapedText = node.expression.expression.escapedText as string;

      if (isDeployFunction(escapedText)) {
        deployFunction = escapedText;
        const optionsNode = node.expression.arguments[1];
        if (optionsNode && isObjectLiteralExpression(optionsNode)) {
          options = parseOptions(optionsNode);
        }
      }
    }
  });

  if (!deployFunction) {
    logger.debug(`No deploy function type found in ${funcPath}`);
    return undefined;
  }

  const rootFunctionBuilder = toRootFunction(deployFunction);
  const functionCodeType = toFunctionCodeType(deployFunction);

  const importPath = `${relative(temporaryDirectory, funcPath)
    .replaceAll('\\', '/')
    .replace(/\.(ts|js)$/, '')}.ts`;
  logger.debug('Generated importPath:', importPath);

  // For Firestore and Database triggers, extract the document/ref path from folder structure
  if (rootFunctionBuilder === 'firestore') {
    const documentPath = extractDocumentPath(funcPath, buildFunctionData.controllersPath);
    if (documentPath) {
      options.document = documentPath;
    }
  } else if (rootFunctionBuilder === 'database') {
    const refPath = extractDatabaseRef(funcPath, buildFunctionData.controllersPath);
    if (refPath) {
      options.ref = refPath;
    }
  }

  const optionsCode = toOptionsCode(options);

  const fileCode = `
import { ${functionCodeType} } from 'firebase-functions/${rootFunctionBuilder}';
import functionStart from '${importPath}';

export const ${functionName} = ${functionCodeType}(${optionsCode}, functionStart);
`;
  return fileCode;
}

const isDeployFunction = (functionName: string): functionName is DeployFunction => {
  return functions.includes(functionName as DeployFunction);
};

const parseOptions = (optionsNode: ObjectLiteralExpression) => {
  const options: Record<string, unknown> = {};
  optionsNode.properties.forEach((prop) => {
    if (isPropertyAssignment(prop) && prop.name) {
      const key = prop.name.getText();
      const value = getInitializerValue(prop.initializer);
      if (value !== undefined) {
        options[key] = value;
      }
    }
  });
  return options;
};

const getInitializerValue = (initializer: Expression): unknown => {
  if (isStringLiteral(initializer)) {
    return initializer.text;
  }
  if (initializer.kind === SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer.kind === SyntaxKind.FalseKeyword) {
    return false;
  }
  if (initializer.kind === SyntaxKind.NumericLiteral) {
    return Number(initializer.getText());
  }
  if (isObjectLiteralExpression(initializer)) {
    return parseOptions(initializer);
  }
  //TODO: add array support
  logger.warn(`Unsupported initializer kind: ${SyntaxKind[initializer.kind]}`);
  return undefined;
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

const toOptionsCode = (options: { [key: string]: unknown }): string => {
  let optionsCode = '{';
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      optionsCode += `'${key}': [${value
        .map((v) => `${typeof v === 'string' ? `'${v}'` : v}`)
        .join(',')}],`;
      continue;
    }

    if (typeof value === 'object') {
      optionsCode += `'${key}': ${toOptionsCode(value as { [key: string]: unknown })},`;
      continue;
    }

    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }

    optionsCode += `'${key}': ${typeof value === 'string' ? `'${value}'` : value},`;
  }
  optionsCode += '}';
  return optionsCode;
};
