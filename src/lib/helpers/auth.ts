import type { EventContext } from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-functions/v1/auth';
import type { AuthUserRecord } from 'firebase-functions/v2/identity';
import type {
  AuthEventContext,
  AuthTriggerOptions,
  BeforeCreateResponse,
  BeforeSignInResponse,
} from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { createAuthEventHandler } from './factory.ts';
import { wrapWithLogContext } from './logging.ts';

export const onAuthCreate = createAuthEventHandler<UserRecord, EventContext, AuthTriggerOptions>(
  'auth.onCreate',
  (_, context) => context.eventId
);

export const onAuthDelete = createAuthEventHandler<UserRecord, EventContext, AuthTriggerOptions>(
  'auth.onDelete',
  (_, context) => context.eventId
);

/**
 * Blocks request to create a Firebase Auth user.
 * @typeParam TCustomClaims - Optional type for custom claims added to the user token.
 */
export const beforeAuthCreate = <TCustomClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) =>
    | BeforeCreateResponse<TCustomClaims>
    | void
    | Promise<BeforeCreateResponse<TCustomClaims>>
    | Promise<void>,
  options?: AuthTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? 5;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) await batch.commit();
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'auth.beforeCreate',
      requestId: crypto.randomUUID(),
    })
  );
};

/**
 * Blocks request to sign-in a Firebase Auth user.
 */
export const beforeAuthSignIn = <TCustomClaims = never, TSessionClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) =>
    | BeforeSignInResponse<TCustomClaims, TSessionClaims>
    | void
    | Promise<BeforeSignInResponse<TCustomClaims, TSessionClaims>>
    | Promise<void>,
  options?: AuthTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? 5;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) await batch.commit();
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'auth.beforeSignIn',
      requestId: crypto.randomUUID(),
    })
  );
};
