import type { Buffer } from 'node:buffer';
import type { Response } from 'express';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { CallableFunctions, HttpsOptions, RequestFunctions } from '$types';
import { FirestackError, HttpStatusCode, HttpsError } from './errors.js';

export interface FirebaseRequest<
  T extends Record<string, string> = Record<string, string>,
  _ResBody = unknown,
  ReqBody = unknown,
> extends Request {
  /** The wire format representation of the request body. */
  rawBody: Buffer;
  body: ReqBody;
  params: T;
}

export type RequestHandler<
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
> = (
  request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
  response: Response<AllFunctions[FunctionName][1]>
) => Promise<void> | void;

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
    try {
      await handler(request, response);
    } catch (error) {
      if (error instanceof HttpsError || error instanceof FirestackError) {
        const statusCode = HttpStatusCode[error.code] || 500;
        response.status(statusCode).send({
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        });
        return;
      }

      console.error('Unhandled error in onRequest:', error);
      response.status(500).send({
        error: {
          message: error instanceof Error ? error.message : 'Internal Server Error',
          code: 'internal',
        },
      });
    }
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
  };
};
