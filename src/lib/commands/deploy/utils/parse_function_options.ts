import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportAssignment,
  isIdentifier,
  isObjectLiteralExpression,
  isVariableDeclaration,
  ScriptTarget,
  type SourceFile,
} from 'typescript';
import { functions } from '$constants';
import { logger } from '$logger';
import type { DeployFunction } from '$types';

// Valid configuration keys for Firebase v2 functions
const VALID_FIREBASE_OPTIONS = new Set([
  // Global / Instance / Runtime options
  'region',
  'memory',
  'timeoutSeconds',
  'minInstances',
  'maxInstances',
  'vpcConnector',
  'vpcConnectorEgressSettings',
  'serviceAccount',
  'ingressSettings',
  'cpu',
  'labels',
  'secrets',
  'concurrency',
  'invoker',
  'omit',
  'cors',
  'preserveExternalChanges',

  // App Check (HTTP/Callable)
  'enforceAppCheck',
  'consumeAppCheckToken',

  // Scheduled Function triggers
  'schedule',
  'timeZone',
  'retryConfig', // Also used by Task Queues
  'retry', // Used by background events (boolean)

  // Eventarc / PubSub / Custom events
  'eventFilters',
  'eventFilterPathPatterns',
  'topic',
  'eventType',
  'channel',

  // Firestore triggers
  'document',
  'database', // For multi-database support in v2

  // Realtime Database triggers
  'ref',
  'instance',

  // Storage triggers
  'bucket',

  // Task Queue triggers
  'rateLimits',
]);

export function extractAndValidateOptions(
  fileContent: string,
  funcPath: string,
  defaultRegion?: string
): { deployFunction?: DeployFunction; options: Record<string, unknown> } {
  // Parsing with ScriptTarget.Latest and setParentNodes to false (default) is incredibly fast
  const sourceFile = createSourceFile(funcPath, fileContent, ScriptTarget.Latest, true);

  let deployFunction: DeployFunction | undefined;
  let optionsString = '{}';

  // 1. Traverse AST to find the export default call
  forEachChild(sourceFile, (node) => {
    if (isExportAssignment(node)) {
      const expression = node.expression;
      if (isCallExpression(expression)) {
        const callee = expression.expression;

        if (isIdentifier(callee) && functions.includes(callee.text as DeployFunction)) {
          deployFunction = callee.text as DeployFunction;

          // 2. Get the last argument
          const args = expression.arguments;
          const lastArg = args[args.length - 1];

          if (lastArg) {
            if (isObjectLiteralExpression(lastArg)) {
              // Scenario A: It's an inline object {...}
              optionsString = lastArg.getText(sourceFile);
            } else if (isIdentifier(lastArg)) {
              // Scenario B: It's a variable reference. Find it!
              optionsString = findVariableObjectLiteral(sourceFile, lastArg.text) ?? '{}';
            }
          }
        }
      }
    }
  });

  if (!deployFunction) {
    return { options: {} };
  }

  // 3. Parse options object safely-ish
  let parsedOptions: Record<string, unknown> = {};
  try {
    parsedOptions = new Function(`return ${optionsString}`)();
  } catch (_e) {
    logger.warn(`Failed to parse options in ${funcPath}. Using empty options.`);
  }

  // 4. Apply Default Region (File-level region takes priority)
  if (!parsedOptions.region && defaultRegion) {
    parsedOptions.region = defaultRegion;
  }

  // 5. Validate the extracted options
  const validatedOptions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsedOptions)) {
    if (VALID_FIREBASE_OPTIONS.has(key)) {
      validatedOptions[key] = value;
    } else {
      logger.debug(`Ignoring invalid/unknown Firebase function option '${key}' in ${funcPath}`);
    }
  }

  // 6. Enforce V2 specific requirements (Fail early!)
  validateV2Options(deployFunction, validatedOptions, funcPath);

  return { deployFunction, options: validatedOptions };
}

/**
 * Enforces V2 specific requirements and types, throwing errors early
 * during the build step rather than failing during deployment.
 */
function validateV2Options(
  deployFunction: DeployFunction,
  options: Record<string, unknown>,
  funcPath: string
): void {
  // 1. Required Trigger Properties
  if (deployFunction === 'onSchedule' && !options.schedule) {
    throw new Error(
      `[Firestack] Build failed: 'onSchedule' in ${funcPath} requires a 'schedule' property.`
    );
  }

  // 2. Type Validations for Common V2 Properties
  if ('memory' in options) {
    const mem = options.memory;
    if (typeof mem !== 'string' && typeof mem !== 'number') {
      throw new Error(
        `[Firestack] Build failed: 'memory' in ${funcPath} must be a string (e.g., '256MB') or a number.`
      );
    }
  }

  if ('concurrency' in options) {
    const conc = options.concurrency;
    if (typeof conc !== 'number' || conc < 1) {
      throw new Error(
        `[Firestack] Build failed: 'concurrency' in ${funcPath} must be a positive number.`
      );
    }
  }

  if ('timeoutSeconds' in options) {
    const timeout = options.timeoutSeconds;
    // Firebase Gen 2 allows up to 3600 seconds (60 mins)
    if (typeof timeout !== 'number' || timeout > 3600 || timeout < 1) {
      throw new Error(
        `[Firestack] Build failed: 'timeoutSeconds' in ${funcPath} must be a number between 1 and 3600.`
      );
    }
  }
}

/**
 * Searches the AST for a variable declaration matching the given name
 * and extracts its object literal value if it exists.
 */
function findVariableObjectLiteral(sourceFile: SourceFile, varName: string): string | undefined {
  let objectString: string | undefined;

  forEachChild(sourceFile, (node) => {
    // Look for variable statements at the top level
    forEachChild(node, (child) => {
      if (isVariableDeclaration(child) && isIdentifier(child.name) && child.name.text === varName) {
        if (child.initializer && isObjectLiteralExpression(child.initializer)) {
          objectString = child.initializer.getText(sourceFile);
        }
      }
    });
  });

  return objectString;
}
