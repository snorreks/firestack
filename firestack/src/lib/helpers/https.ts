import type { Buffer } from 'node:buffer';
import type { Response } from 'express';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { CallableFunctions, HttpsOptions, RequestFunctions } from '$types';

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
  Params extends Record<string, string> = Record<string, string>
> = (
  request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
  response: Response<AllFunctions[FunctionName][1]>
) => Promise<void> | void;

/**
 * Handles HTTPS requests.
 * ...
 */
export const onRequest = <
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  // 2. UPDATE THIS: Use the new RequestHandler type for the parameter and explicit return type
  handler: RequestHandler<AllFunctions, FunctionName, Params>,
  _options?: HttpsOptions<FunctionName>
): RequestHandler<AllFunctions, FunctionName, Params> => handler;


export type CallHandler<
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions
> = (
  request: CallableRequest<AllFunctions[FunctionName][0]>
) => Promise<AllFunctions[FunctionName][1]> | AllFunctions[FunctionName][1];

/**
 * Declares a callable method for clients to call using a Firebase SDK.
 * ...
 */
export const onCall = <
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  // 4. UPDATE THIS: Use the new CallHandler type
  handler: CallHandler<AllFunctions, FunctionName>,
  _options?: HttpsOptions<FunctionName>
): CallHandler<AllFunctions, FunctionName> => handler;
