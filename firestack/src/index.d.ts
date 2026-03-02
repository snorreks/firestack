import type { EventContext } from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-functions/v1/auth';
import type { AuthUserRecord } from 'firebase-functions/v2/identity';
import type { Change, ParamsOf } from 'firebase-functions/v2/core';
import type { DatabaseEvent, DataSnapshot } from 'firebase-functions/v2/database';
import type {
  Change as FirestoreChange,
  DocumentSnapshot,
  FirestoreEvent,
  QueryDocumentSnapshot,
} from 'firebase-functions/v2/firestore';
import type { CallableRequest, Request } from 'firebase-functions/v2/https';
import type { StorageEvent } from 'firebase-functions/v2/storage';
import type { Response } from 'express';
import type { Buffer } from 'node:buffer';

export type NodeVersion = '14' | '16' | '18' | '20' | '22';

export interface BaseFunctionOptions<T extends string = string> {
  functionName?: T;
  external?: string[];
  keepNames?: boolean;
  assets?: string[];
  nodeVersion?: NodeVersion;
  region?: string | string[];
  memory?: '128MB' | '256MB' | '512MB' | '1GB' | '2GB';
  timeout?: string;
  minInstances?: number;
  maxInstances?: number;
  concurrency?: number;
  retry?: boolean | string;
}

export interface HttpsOptions<T extends string | number | symbol = string> extends BaseFunctionOptions<Extract<T, string>> {
  cors?: string | string[];
}

export interface DocumentOptions extends BaseFunctionOptions {
  document?: string;
}

export interface ReferenceOptions extends BaseFunctionOptions {
  ref: string;
}

export interface ScheduleOptions extends BaseFunctionOptions {
  schedule: string;
  timeZone?: string;
}

export interface ObjectTriggerOptions extends BaseFunctionOptions {
  bucket?: string;
}

export type AuthTriggerOptions = BaseFunctionOptions;

export type CallableFunctions = {
  [key: string]: [unknown, unknown];
};

export type RequestFunctions = {
  [key: string]: [
    {
      [key: string]: unknown;
    },
    unknown,
  ];
};

export interface CoreData {
  id: string;
}

export interface ExecutorBaseOptions {
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

export interface ExecutorBaseBuildOptions extends ExecutorBaseOptions {
  tsconfig?: string;
  validate?: boolean;
  includeFilePath?: string;
  nodeVersion?: NodeVersion;
  sourcemap?: boolean;
  requireFix?: boolean;
}

export type FunctionOptions = {
  https: HttpsOptions;
  firestore: DocumentOptions;
  scheduler: ScheduleOptions;
  storage: ObjectTriggerOptions;
  database: ReferenceOptions;
  auth: AuthTriggerOptions;
};

export interface AuthEventContext {
  authType?: string;
  credential?: {
    idToken?: string;
    accessToken?: string;
  };
  userRecord?: AuthUserRecord;
}

export type BeforeCreateResponse = {
  abort: string | Error;
};

export type BeforeSignInResponse = {
  abort: string | Error;
};

export interface FirebaseRequest<
  T extends Record<string, string> = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
> extends Request {
  rawBody: Buffer;
  body: ReqBody;
  params: T;
}

export function onAuthCreate(
  handler: (user: UserRecord, context: EventContext) => PromiseLike<unknown> | unknown,
  options?: AuthTriggerOptions
): typeof handler;

export function onAuthDelete(
  handler: (user: UserRecord, context: EventContext) => PromiseLike<unknown> | unknown,
  options?: AuthTriggerOptions
): typeof handler;

export function beforeAuthCreate(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext
  ) => BeforeCreateResponse | void | Promise<BeforeCreateResponse> | Promise<void>,
  options?: AuthTriggerOptions
): typeof handler;

export function beforeAuthSignIn(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext
  ) => BeforeSignInResponse | void | Promise<BeforeSignInResponse> | Promise<void>,
  options?: AuthTriggerOptions
): typeof handler;

export function onValueCreated<Ref extends string = string>(
  handler: (event: DatabaseEvent<DataSnapshot, ParamsOf<Ref>>) => PromiseLike<unknown> | unknown,
  options: ReferenceOptions
): typeof handler;

export function onValueDeleted<Ref extends string = string>(
  handler: (event: DatabaseEvent<DataSnapshot, ParamsOf<Ref>>) => PromiseLike<unknown> | unknown,
  options: ReferenceOptions
): typeof handler;

export function onValueUpdated<Ref extends string = string>(
  handler: (
    event: DatabaseEvent<FirestoreChange<DataSnapshot>, ParamsOf<Ref>>
  ) => PromiseLike<unknown> | unknown,
  options: ReferenceOptions
): typeof handler;

export function onValueWritten<Ref extends string = string>(
  handler: (
    event: DatabaseEvent<FirestoreChange<DataSnapshot>, ParamsOf<Ref>>
  ) => PromiseLike<unknown> | unknown,
  options: ReferenceOptions
): typeof handler;

export function onDocumentCreated<Document extends string = string>(
  handler: (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): typeof handler;

export function onDocumentDeleted<Document extends string = string>(
  handler: (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): typeof handler;

export function onDocumentUpdated<Document extends string = string>(
  handler: (
    event: FirestoreEvent<FirestoreChange<QueryDocumentSnapshot> | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): typeof handler;

export function onDocumentWritten<Document extends string = string>(
  handler: (
    event: FirestoreEvent<FirestoreChange<DocumentSnapshot> | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): typeof handler;

export function onCreated<T extends CoreData>(
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => PromiseLike<unknown> | unknown;

export function onDeleted<T extends CoreData>(
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => PromiseLike<unknown> | unknown;

export function onUpdated<T extends CoreData>(
  handler: (
    event: FirestoreEvent<{
      before: T;
      after: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): (event: FirestoreEvent<FirestoreChange<QueryDocumentSnapshot> | undefined, ParamsOf<string>>) => PromiseLike<unknown> | unknown;

export function onWritten<T extends CoreData>(
  handler: (
    event: FirestoreEvent<{
      before?: T;
      after?: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions
): (event: FirestoreEvent<FirestoreChange<DocumentSnapshot> | undefined, ParamsOf<string>>) => PromiseLike<unknown> | unknown;

export function onRequest<
  AllFunctions extends RequestFunctions,
  FunctionName extends keyof AllFunctions,
  Params extends Record<string, string> = Record<string, string>,
>(
  handler: (
    request: FirebaseRequest<Params, AllFunctions[FunctionName][1], AllFunctions[FunctionName][0]>,
    response: Response<AllFunctions[FunctionName][1]>
  ) => Promise<void> | void,
  options?: HttpsOptions<FunctionName>
): typeof handler;

export function onCall<
  AllFunctions extends CallableFunctions,
  FunctionName extends keyof AllFunctions,
>(
  handler: (
    request: CallableRequest<AllFunctions[FunctionName][0]>
  ) => Promise<AllFunctions[FunctionName][1]> | AllFunctions[FunctionName][1],
  options?: HttpsOptions<FunctionName>
): typeof handler;

export function onSchedule(
  handler: (context: EventContext) => PromiseLike<unknown> | unknown,
  options: ScheduleOptions
): typeof handler;

export function onObjectArchived(
  handler: (event: StorageEvent) => PromiseLike<unknown> | unknown,
  options?: ObjectTriggerOptions
): typeof handler;

export function onObjectDeleted(
  handler: (event: StorageEvent) => PromiseLike<unknown> | unknown,
  options?: ObjectTriggerOptions
): typeof handler;

export function onObjectFinalized(
  handler: (event: StorageEvent) => PromiseLike<unknown> | unknown,
  options?: ObjectTriggerOptions
): typeof handler;

export function onObjectMetadataUpdated(
  handler: (event: StorageEvent) => PromiseLike<unknown> | unknown,
  options?: ObjectTriggerOptions
): typeof handler;
