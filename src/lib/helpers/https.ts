import type { Buffer } from 'node:buffer';
import type { Response } from 'express';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { z } from 'zod';
import type { CallableFunctions, HttpsOptions, RequestFunctions, ZodOptions } from '$types';
import { handleZodError } from '$utils/zod.ts';
import { FirestackError, HttpStatusCode, HttpsError } from './errors.ts';
import { runWithLogContext } from './logging.ts';

export type FirebaseRequest<
  T extends Record<string, string> = Record<string, string>,
  _ResBody = unknown,
  ReqBody = unknown,
> = Request & {
  /** The wire format representation of the request body. */
  rawBody: Buffer;
  body: ReqBody;
  params: T;
};

export type RequestHandler<
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
> = (
  request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
  response: Response<AllFunctions[FunctionName][1]>
) => Promise<void> | void;

/**
 * Builds a log context from an HTTP request.
 */
const buildRequestLogContext = (request: FirebaseRequest) => {
  const userAgent = request.headers['user-agent'];
  return {
    source: 'functions' as const,
    trigger: 'https.onRequest',
    ip: request.ip ?? undefined,
    route: request.path ?? undefined,
    method: request.method,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    requestId: crypto.randomUUID(),
  };
};

/**
 * Builds a log context from a callable request.
 */
const buildCallLogContext = (request: CallableRequest<unknown>) => {
  const rawRequest = request.rawRequest;
  const userAgent = rawRequest?.headers['user-agent'];
  return {
    source: 'functions' as const,
    trigger: 'https.onCall',
    userId: request.auth?.uid,
    ip: rawRequest?.ip ?? undefined,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    requestId: crypto.randomUUID(),
  };
};

/**
 * Handles errors for HTTPS requests.
 */
const handleHttpsError = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
>(
  error: unknown,
  response: Response<AllFunctions[FunctionName][1]>
) => {
  if (error instanceof HttpsError || error instanceof FirestackError) {
    const statusCode = HttpStatusCode[error.code] || 500;
    response.status(statusCode).send({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    } as unknown as AllFunctions[FunctionName][1]);
    return;
  }

  console.error('Unhandled error in onRequest:', error);
  response.status(500).send({
    error: {
      message: error instanceof Error ? error.message : 'Internal Server Error',
      code: 'internal',
    },
  } as unknown as AllFunctions[FunctionName][1]);
};

/**
 * Handles HTTPS requests.
 * @param handler - The request handler function.
 * @param _options - Optional configuration for the HTTPS request.
 * @returns The request handler wrapped in a try-catch block for standardized error handling.
 */
export const onRequest = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  handler: RequestHandler<AllFunctions, FunctionName, Params>,
  _options?: HttpsOptions<FunctionName>
): RequestHandler<AllFunctions, FunctionName, Params> => {
  return async (request, response) => {
    const logContext = buildRequestLogContext(request);
    await runWithLogContext(logContext, async () => {
      try {
        await handler(request, response);
      } catch (error) {
        handleHttpsError<AllFunctions, FunctionName>(error, response);
      }
    });
  };
};

/**
 * Handles HTTPS requests with Zod validation.
 * @param schema - The Zod schema for the request body.
 * @param handler - The request handler function.
 * @param options - Configuration for the HTTPS request and Zod validation.
 */
export const onRequestZod = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  schema: z.ZodSchema<AllFunctions[FunctionName][0]>,
  handler: RequestHandler<AllFunctions, FunctionName, Params>,
  options?: HttpsOptions<FunctionName> & ZodOptions
): RequestHandler<AllFunctions, FunctionName, Params> => {
  return async (request, response) => {
    const logContext = buildRequestLogContext(request);
    await runWithLogContext(logContext, async () => {
      try {
        const result = schema.safeParse(request.body);

        if (!result.success) {
          handleZodError({
            error: result.error,
            ...options,
          });

          if (options?.validationStrategy === 'ignore') {
            return handler(request, response);
          }

          response.status(400).send({
            error: {
              message: 'Invalid request body',
              code: 'invalid-argument',
              details: result.error.issues,
            },
          } as unknown as AllFunctions[FunctionName][1]);
          return;
        }

        request.body = result.data;
        return handler(request, response);
      } catch (error) {
        handleHttpsError<AllFunctions, FunctionName>(error, response);
      }
    });
  };
};

export type CallHandler<
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
> = (
  request: CallableRequest<AllFunctions[FunctionName][0]>
) => Promise<AllFunctions[FunctionName][1]> | AllFunctions[FunctionName][1];

/**
 * Declares a callable method for clients to call using a Firebase SDK.
 * @param handler - The call handler function.
 * @param _options - Optional configuration for the callable function.
 * @returns The call handler wrapped in a try-catch block for standardized error handling.
 */
export const onCall = <
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  handler: CallHandler<AllFunctions, FunctionName>,
  _options?: HttpsOptions<FunctionName>
): CallHandler<AllFunctions, FunctionName> => {
  return async (request) => {
    const logContext = buildCallLogContext(request);
    return runWithLogContext(logContext, async () => {
      try {
        return await handler(request);
      } catch (error) {
        if (error instanceof HttpsError || error instanceof FirestackError) {
          throw error;
        }

        console.error('Unhandled error in onCall:', error);
        throw new HttpsError(
          'internal',
          error instanceof Error ? error.message : 'Internal Server Error'
        );
      }
    });
  };
};

/**
 * Declares a callable method with Zod validation.
 * @param schema - The Zod schema for the request data.
 * @param handler - The call handler function.
 * @param options - Configuration for the callable function and Zod validation.
 */
export const onCallZod = <
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  schema: z.ZodSchema<AllFunctions[FunctionName][0]>,
  handler: CallHandler<AllFunctions, FunctionName>,
  options?: HttpsOptions<FunctionName> & ZodOptions
): CallHandler<AllFunctions, FunctionName> => {
  return async (request) => {
    const logContext = buildCallLogContext(request);
    return runWithLogContext(logContext, async () => {
      try {
        const result = schema.safeParse(request.data);

        if (!result.success) {
          handleZodError({
            error: result.error,
            ...options,
          });

          if (options?.validationStrategy === 'ignore') {
            return handler(request);
          }

          throw new HttpsError('invalid-argument', 'Invalid request data', result.error.issues);
        }

        request.data = result.data;
        return handler(request);
      } catch (error) {
        if (error instanceof HttpsError || error instanceof FirestackError) {
          throw error;
        }

        console.error('Unhandled error in onCallZod:', error);
        throw new HttpsError(
          'internal',
          error instanceof Error ? error.message : 'Internal Server Error'
        );
      }
    });
  };
};
