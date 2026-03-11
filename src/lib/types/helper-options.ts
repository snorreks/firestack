import type { ReferenceOptions as FBReferenceOptions } from 'firebase-functions/v2/database';
import type { DocumentOptions as FBDocumentOptions } from 'firebase-functions/v2/firestore';
import type { HttpsOptions as FirebaseHttpsOptions } from 'firebase-functions/v2/https';
import type { GlobalOptions } from 'firebase-functions/v2/options';
import type { ScheduleOptions as FBScheduleOptions } from 'firebase-functions/v2/scheduler';
import type { StorageOptions } from 'firebase-functions/v2/storage';
import type { VALID_FIREBASE_OPTIONS } from '$constants';
export type NodeVersion = '18' | '20' | '22' | '24';

export type BaseFunctionOptions<T extends string = string> = GlobalOptions & {
  /**
   * The name of the function. If not provided, the name of the function is
   * the path from the root of the {@link DeployDirectory} directory to the
   * file. Replacing all `/` and `-` with `_`.
   *
   * example // api/stripe/webhook.ts => stripe_webhook
   *
   * example // callable/auth/check-email.ts => auth_check_email
   */
  functionName?: T;

  /**
   * Some packages needs to be installed as external dependencies.
   *
   * @example external: ['sharp'] // will npm i sharp in dist
   */
  external?: string[];

  /**
   * Documentation: https://esbuild.github.io/api/#keep-names
   *
   * @default true
   */
  keepNames?: boolean;

  /**
   * Path to the assets from the project root directory.
   *
   * NB this will be placed in the same directory as the function.
   */
  assets?: string[];

  nodeVersion?: NodeVersion;
};

export type HttpsOptions<T extends string | number | symbol = string> = Omit<
  BaseFunctionOptions<Extract<T, string>>,
  'region'
> &
  FirebaseHttpsOptions;

export type DocumentOptions = Omit<BaseFunctionOptions, 'enforceAppCheck'> &
  Omit<FBDocumentOptions, 'document'>;

export type ReferenceOptions = Omit<BaseFunctionOptions, 'enforceAppCheck'> &
  FBReferenceOptions & {
    ref: string;
  };

export type ScheduleOptions = Omit<BaseFunctionOptions, 'enforceAppCheck'> & FBScheduleOptions;

export type ObjectTriggerOptions = Omit<BaseFunctionOptions, 'region'> & StorageOptions;

export type AuthTriggerOptions = Omit<BaseFunctionOptions, 'region'>;

export type AllFunctionOptions = {
  https: HttpsOptions;
  firestore: DocumentOptions;
  scheduler: ScheduleOptions;
  storage: ObjectTriggerOptions;
  database: ReferenceOptions;
  auth: AuthTriggerOptions;
};

export type OptionValue = string | boolean | Record<string, unknown>;
//
export type FunctionOptions = Partial<Record<(typeof VALID_FIREBASE_OPTIONS)[number], OptionValue>>;

export type FirestackOptions = {
  functionName?: string;
  nodeVersion?: NodeVersion;
  assets?: string[];
  external?: string[];
};
