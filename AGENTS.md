# Code Standards

## General

- All methods must be JSDoc commented
- All methods with multiple arguments should use an options object: `{...}` instead of chained arguments
- Use `options` instead of `opts`
- Escape early (return early pattern)
- If a section can be a separate method, make it a separate method
- Follow style in biome.json
- Never use `any` type
- Never use `null` (prefer `undefined`)
- Never use non-null assertion (`!`)
- Use arrow functions
- Use `type` over `interface` (unless extending)
- Options types that are only used in a single method should be defined inside that method, not exported

## Code Style

- Never abbreviate variable names (use `functionName` not `fnName`, `options` not `opts`)
- Always use braces for if/else statements, even single-line:

```typescript
// ✅ CORRECT
if (condition) {
  doSomething();
}

// ❌ WRONG
if (condition) doSomething();
```

## Logging

- Use the logger from `$logger`
- Use `logger.debug` for detailed logging
- Keep logging professional and standard

## Imports

Always use path aliases:

```typescript
import { logger } from "$logger";
import type { SomeType } from "$types";
import { someHelper } from "$utils/build_utils.ts";
import { SOME_CONSTANT } from "$constants";
```

## Example

```typescript
import { logger } from "$logger";

type ProcessInputOptions = {
  validate?: boolean;
  transform?: (input: string) => string;
};

/**
 * Processes the given input and returns a formatted result.
 * @param options - Configuration options
 * @returns The processed result
 */
export const processInput = (options: ProcessInputOptions): ProcessedResult => {
  const { input, validate = true, transform } = options;

  if (!input) {
    return { success: false, error: "Input is required" };
  }

  if (validate) {
    const validated = validateInput(input);
    if (!validated) {
      logger.debug("Input validation failed", { input });
      return { success: false, error: "Invalid input" };
    }
  }

  const transformed = transform ? transform(input) : input;
  const result = doProcess(transformed);

  logger.debug("Input processed successfully", {
    resultSize: result.data.length,
  });

  return { success: true, data: result };
};
```
