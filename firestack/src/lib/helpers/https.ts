import type { Buffer } from 'node:buffer';
import type { Response } from 'express';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { CallableFunctions, HttpsOptions, RequestFunctions } from '../types/index.js';

interface FirebaseRequest<
  T extends Record<string, string> = Record<string, string>,
  _ResBody = unknown,
  ReqBody = unknown,
> extends Request {
  /** The wire format representation of the request body. */
  rawBody: Buffer;
  body: ReqBody;
  params: T;
}

/**
 * Handles HTTPS requests.
 *
 * @param handler - A function that takes a {@link https.Request} and response
 *   object, same signature as an Express app.
 * @param _options - Options to set on this function
 * @returns A function that you can export and deploy.
 */
export const onRequest = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  handler: (
    request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
    response: Response<AllFunctions[FunctionName][1]>
  ) => Promise<void> | void,
  _options?: HttpsOptions<FunctionName>
) => handler;

/**
 * Declares a callable method for clients to call using a Firebase SDK.
 *
 * @param handler - A function that takes a {@link https.CallableRequest}.
 * @param _options - Options to set on this function.
 * @returns A function that you can export and deploy.
 */
export const onCall = <
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  handler: (
    request: CallableRequest<AllFunctions[FunctionName][0]>
  ) => Promise<AllFunctions[FunctionName][1]> | AllFunctions[FunctionName][1],
  _options?: HttpsOptions<FunctionName>
) => handler;
