import type { Buffer } from 'node:buffer';
import type { Response } from 'express';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { z } from 'zod';
import type { CallableFunctions, HttpsOptions, RequestFunctions, ZodOptions } from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { handleZodError } from '$utils/zod.ts';
import { FirestackError, HttpStatusCode, HttpsError } from './errors.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

export type FirebaseRequest<
  T extends Record<string, string> = Record<string, string>,
  _ResBody = unknown,
  ReqBody = unknown,
> = Omit<Request, 'body'> & {
  rawBody: Buffer;
  body: ReqBody;
  params: T;
};

/** User-facing handler type (receives batch). */
export type RequestHandler<
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
> = (
  request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]> & {
    batch: Batch;
  },
  response: Response<AllFunctions[FunctionName][1]>
) => Promise<void> | void;

/** User-facing Zod request handler type (receives batch). */
export type ZodRequestHandler<
  Body extends Record<string, unknown> = Record<string, unknown>,
  ResBody = unknown,
  Params extends Record<string, string> = Record<string, string>,
> = (
  request: FirebaseRequest<Params, ResBody, Body> & { batch: Batch },
  response: Response<ResBody>
) => Promise<void> | void;

/** User-facing call handler type (receives batch). */
export type CallHandler<
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
> = (
  request: CallableRequest<AllFunctions[FunctionName][0]> & { batch: Batch }
) => Promise<AllFunctions[FunctionName][1]> | AllFunctions[FunctionName][1];

/** User-facing Zod call handler type (receives batch). */
export type ZodCallHandler<Body = unknown, ResBody = unknown> = (
  request: CallableRequest<Body> & { batch: Batch }
) => Promise<ResBody> | ResBody;

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
const handleHttpsError = <ResBody = unknown>(error: unknown, response: Response<ResBody>) => {
  if (error instanceof HttpsError || error instanceof FirestackError) {
    const statusCode = HttpStatusCode[error.code] || 500;
    response.status(statusCode).send({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    } as unknown as ResBody);
    return;
  }

  console.error('Unhandled error in onRequest:', error);
  response.status(500).send({
    error: {
      message: error instanceof Error ? error.message : 'Internal Server Error',
      code: 'internal',
    },
  } as unknown as ResBody);
};

/**
 * Creates a wrapped onRequest handler with batch support.
 * Uses `wrapWithLogContext` to keep the return type opaque (avoids TS2883).
 */
const withRequestBatch = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  handler: RequestHandler<AllFunctions, FunctionName, Params>,
  concurrency: number
) => {
  return (
    request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
    response: Response<AllFunctions[FunctionName][1]>
  ) => {
    const batch = createBatch({ concurrency });
    return Promise.resolve(handler({ ...request, batch }, response)).then((result) => {
      if (!batch.isEmpty) {
        return batch.commit().then(() => result);
      }
      return result;
    });
  };
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
  options?: HttpsOptions<FunctionName>
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (
      request: FirebaseRequest<
        Params,
        AllFunctions[FunctionName][1],
        AllFunctions[FunctionName][0]
      >,
      response: Response<AllFunctions[FunctionName][1]>
    ) => {
      try {
        await withRequestBatch(handler, concurrency)(request, response);
      } catch (error) {
        handleHttpsError(error, response);
      }
    },
    (request) => buildRequestLogContext(request)
  );
};

/**
 * Creates a wrapped onRequestZod handler with batch and Zod validation.
 */
const withRequestZodBatch = <
  Body extends Record<string, unknown>,
  ResBody = unknown,
  Params extends Record<string, string> = Record<string, string>,
>(
  schema: z.ZodSchema<Body>,
  handler: ZodRequestHandler<Body, ResBody, Params>,
  options: (HttpsOptions<string> & ZodOptions) | undefined,
  concurrency: number
) => {
  return async (request: FirebaseRequest<Params, ResBody, Body>, response: Response<ResBody>) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      handleZodError({ error: result.error, ...options });

      if (options?.validationStrategy === 'ignore') {
        const batch = createBatch({ concurrency });
        const handlerResult = await handler({ ...request, batch }, response);
        if (!batch.isEmpty) {
          await batch.commit();
        }
        return handlerResult;
      }

      response.status(400).send({
        error: {
          message: 'Invalid request body',
          code: 'invalid-argument',
          details: result.error.issues,
        },
      } as unknown as ResBody);
      return;
    }

    const batch = createBatch({ concurrency });
    request.body = result.data;
    const handlerResult = await handler({ ...request, batch }, response);
    if (!batch.isEmpty) {
      await batch.commit();
    }
    return handlerResult;
  };
};

/**
 * Handles HTTPS requests with Zod validation.
 * @param schema - The Zod schema for the request body.
 * @param handler - The request handler function.
 * @param options - Configuration for the HTTPS request and Zod validation.
 */
export const onRequestZod = <
  Body extends Record<string, unknown>,
  ResBody = unknown,
  Params extends Record<string, string> = Record<string, string>,
>(
  schema: z.ZodSchema<Body>,
  handler: ZodRequestHandler<Body, ResBody, Params>,
  options?: HttpsOptions<string> & ZodOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (request: FirebaseRequest<Params, ResBody, Body>, response: Response<ResBody>) => {
      try {
        await withRequestZodBatch(schema, handler, options, concurrency)(request, response);
      } catch (error) {
        handleHttpsError(error, response);
      }
    },
    (request) => buildRequestLogContext(request)
  );
};

/**
 * Creates a wrapped onCall handler with batch support.
 */
const withCallBatch = <
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  handler: CallHandler<AllFunctions, FunctionName>,
  concurrency: number
) => {
  return (request: CallableRequest<AllFunctions[FunctionName][0]>) => {
    const batch = createBatch({ concurrency });
    return Promise.resolve(handler({ ...request, batch })).then((result) => {
      if (!batch.isEmpty) {
        return batch.commit().then(() => result);
      }
      return result;
    });
  };
};

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
  options?: HttpsOptions<FunctionName>
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;
  const wrapped = withCallBatch(handler, concurrency);

  return wrapWithLogContext(
    async (request: CallableRequest<AllFunctions[FunctionName][0]>) => {
      try {
        return await wrapped(request);
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
    },
    (request) => buildCallLogContext(request)
  );
};

/**
 * Creates a wrapped onCallZod handler with batch and Zod validation.
 */
const withCallZodBatch = <Body, ResBody = unknown>(
  schema: z.ZodSchema<Body>,
  handler: ZodCallHandler<Body, ResBody>,
  options: (HttpsOptions<string> & ZodOptions) | undefined,
  concurrency: number
) => {
  return async (request: CallableRequest<Body>) => {
    const result = schema.safeParse(request.data);

    if (!result.success) {
      handleZodError({ error: result.error, ...options });

      if (options?.validationStrategy === 'ignore') {
        const batch = createBatch({ concurrency });
        const handlerResult = await handler({ ...request, batch });
        if (!batch.isEmpty) {
          await batch.commit();
        }
        return handlerResult;
      }

      throw new HttpsError('invalid-argument', 'Invalid request data', result.error.issues);
    }

    const batch = createBatch({ concurrency });
    request.data = result.data;
    const handlerResult = await handler({ ...request, batch });
    if (!batch.isEmpty) {
      await batch.commit();
    }
    return handlerResult;
  };
};

/**
 * Declares a callable method with Zod validation.
 * @param schema - The Zod schema for the request data.
 * @param handler - The call handler function.
 * @param options - Configuration for the callable function and Zod validation.
 */
export const onCallZod = <Body, ResBody = unknown>(
  schema: z.ZodSchema<Body>,
  handler: ZodCallHandler<Body, ResBody>,
  options?: HttpsOptions<string> & ZodOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;
  const wrapped = withCallZodBatch(schema, handler, options, concurrency);

  return wrapWithLogContext(
    async (request: CallableRequest<Body>) => {
      try {
        return await wrapped(request);
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
    },
    (request) => buildCallLogContext(request)
  );
};
