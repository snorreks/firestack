import type { z } from 'zod';
import { logger } from '$logger';
import type { ZodOptions } from '$types';

/**
 * Handles Zod validation errors based on the provided strategy.
 * @param options - Validation error handling options
 */
export const handleZodError = (
  options: {
    error: z.ZodError;
    context?: string;
  } & ZodOptions
) => {
  const { error, validationStrategy = 'warn', context, onValidationError } = options;

  if (onValidationError) {
    onValidationError(error);
  }

  if (validationStrategy === 'ignore') {
    return;
  }

  if (validationStrategy === 'error') {
    throw error;
  }

  logger.warn(`Zod validation failed ${context ? `(${context})` : ''}`, {
    issues: error.issues,
  });
};
