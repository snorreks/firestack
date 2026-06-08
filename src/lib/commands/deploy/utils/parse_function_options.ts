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
import { functions, VALID_FIREBASE_OPTIONS, VALID_FIRESTACK_OPTIONS } from '$constants';
import { logger } from '$logger';
import type { DeployFunction, FirestackOptions, FunctionOptions, OptionValue } from '$types';
import { parseOptionsObject } from '$utils/parse_options_object.ts';

export const extractAndValidateOptions = (options: {
  fileContent: string;
  functionPath: string;
  defaultRegion?: string;
}): {
  deployFunction?: DeployFunction;
  functionOptions: FunctionOptions;
  firestackOptions: FirestackOptions;
} => {
  const { fileContent, functionPath, defaultRegion } = options;
  // Parsing with ScriptTarget.Latest and setParentNodes to false (default) is incredibly fast
  const sourceFile = createSourceFile(functionPath, fileContent, ScriptTarget.Latest, true);

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
    return { functionOptions: {}, firestackOptions: {} };
  }

  // 3. Parse options object with safe parser (no eval)
  const parsedOptions = parseOptionsObject(optionsString) ?? {};

  // 4. Apply Default Region (File-level region takes priority)
  if (!parsedOptions.region && defaultRegion) {
    parsedOptions.region = defaultRegion;
  }

  // 5. Validate the extracted options
  const functionOptions: FunctionOptions = {};
  const firestackOptions: FirestackOptions = {};
  for (const [key, value] of Object.entries(parsedOptions)) {
    if (VALID_FIREBASE_OPTIONS.includes(key as (typeof VALID_FIREBASE_OPTIONS)[number])) {
      functionOptions[key as (typeof VALID_FIREBASE_OPTIONS)[number]] = value as OptionValue;
    } else if (VALID_FIRESTACK_OPTIONS.includes(key as (typeof VALID_FIRESTACK_OPTIONS)[number])) {
      (firestackOptions as Record<string, unknown>)[key] = value;
    } else {
      logger.debug(`Ignoring invalid/unknown Firebase function option '${key}' in ${functionPath}`);
    }
  }

  // 6. Enforce V2 specific requirements (Fail early!)
  validateV2Options({
    ...options,
    deployFunction,
    functionOptions,
  });

  // 6. Enforce one-function-per-file
  enforceSingleExport({ sourceFile, functionPath });

  return { deployFunction, functionOptions, firestackOptions };
};

/**
 * Ensures each function file exports exactly one default.
 * Multiple defaults or mixed named + default exports are errors.
 */
const enforceSingleExport = (options: { sourceFile: SourceFile; functionPath: string }): void => {
  const { sourceFile, functionPath } = options;
  let defaultCount = 0;

  forEachChild(sourceFile, (node) => {
    if (isExportAssignment(node)) {
      defaultCount++;
    }
  });

  if (defaultCount > 1) {
    throw new Error(
      `[Firestack] Build failed: ${functionPath} has ${defaultCount} default exports. One function per file is required.`
    );
  }
};

/**
 * Enforces V2 specific requirements and types, throwing errors early
 * during the build step rather than failing during deployment.
 */
const validateV2Options = (options: {
  deployFunction: DeployFunction;
  functionOptions: Record<string, unknown>;
  functionPath: string;
}): void => {
  const { deployFunction, functionOptions, functionPath } = options;

  const fail = (message: string) => {
    throw new Error(`[Firestack] Build failed: ${message} in ${functionPath}`);
  };

  // --- Required trigger properties per builder ---
  if (deployFunction === 'onSchedule' && !functionOptions.schedule) {
    fail(`'onSchedule' requires a 'schedule' property`);
  }

  if (deployFunction === 'onMessagePublished' && !functionOptions.topic) {
    fail(`'onMessagePublished' requires a 'topic' property`);
  }

  if (deployFunction === 'onCustomEventPublished' && !functionOptions.eventType) {
    fail(`'onCustomEventPublished' requires an 'eventType' property`);
  }

  // 2. Type Validations for Common V2 Properties
  if ('memory' in functionOptions) {
    const mem = functionOptions.memory;
    if (typeof mem !== 'string' && typeof mem !== 'number') {
      throw new Error(
        `[Firestack] Build failed: 'memory' in ${functionPath} must be a string (e.g., '256MB') or a number.`
      );
    }
  }

  if ('concurrency' in functionOptions) {
    const conc = functionOptions.concurrency;
    if (typeof conc !== 'number' || conc < 1) {
      throw new Error(
        `[Firestack] Build failed: 'concurrency' in ${functionPath} must be a positive number.`
      );
    }
  }

  if ('timeoutSeconds' in functionOptions) {
    const timeout = functionOptions.timeoutSeconds;
    // Firebase Gen 2 allows up to 3600 seconds (60 mins)
    if (typeof timeout !== 'number' || timeout > 3600 || timeout < 1) {
      throw new Error(
        `[Firestack] Build failed: 'timeoutSeconds' in ${functionPath} must be a number between 1 and 3600.`
      );
    }
  }
};

/**
 * Searches the AST for a variable declaration matching the given name
 * and extracts its object literal value if it exists.
 */
const findVariableObjectLiteral = (sourceFile: SourceFile, varName: string): string | undefined => {
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
};
