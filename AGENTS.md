# Code Standards

## General

- All methods must be JSDoc commented
- All methods with multiple arguments should use an options object: `{...}` instead of chained arguments
- Use `options` instead of `opts`
- Escape early (return early pattern)
- If a section can be a separate method, make it a separate method
- Follow style in biome.json
- Never use `any` type
- Never use non-null assertion (`!`)

## One Function Per File

**The package only supports ONE function per file.** Each file must contain a single function exported as default.

```typescript
// ✅ CORRECT - one function per file
// src/controllers/api/my_handler.ts
import { onRequest } from '@snorreks/firestack';

export default onRequest((request, response) => {
  response.send({ ok: true });
});
```

```typescript
// ❌ WRONG - multiple functions in same file
// src/controllers/api/my_handler.ts
import { onRequest } from '@snorreks/firestack';

export const handler1 = onRequest((req, res) => { ... });
export const handler2 = onRequest((req, res) => { ... }); // Won't work!
```

Each controller file should be in its own file under `controllers/`:
```
controllers/
  api/
    users.ts       <- one function
    posts.ts       <- one function
  firestore/
    users/
      [uid]/
        created.ts <- one function
        deleted.ts <- one function
```

## Export Default

Always use `export default` at the end of the file:

```typescript
import { onRequest } from '@snorreks/firestack';

export default onRequest((request, response) => {
  response.send({ ok: true });
});
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

  logger.debug("Input processed successfully", { resultSize: result.data.length });

  return { success: true, data: result };
};
```
