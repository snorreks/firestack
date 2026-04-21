import type { z } from 'zod';

/**
 * What to do when validation fails.
 *
 * - `warn`: Log a warning to the console, and continue with the original data.
 * - `error`: Throw a Zod error, preventing the function from continuing.
 * - `ignore`: Do not log anything, and continue with the original data.
 *
 */
export type ZodValidationStrategy = 'warn' | 'error' | 'ignore';

export type ZodOptions = {
  /**
   * What to do when validation fails.
   *
   * - `warn`: Log a warning to the console, and continue with the original data.
   * - `error`: Throw a Zod error, preventing the function from continuing.
   * - `ignore`: Do not log anything, and continue with the original data.
   *
   * @default 'warn'
   */
  validationStrategy?: ZodValidationStrategy;

  /**
   * An optional callback to handle validation errors.
   *
   * This is useful for custom error reporting (e.g., Sentry).
   *
   * @param error - The Zod validation error.
   */
  onValidationError?: (error: z.ZodError) => void;
};
