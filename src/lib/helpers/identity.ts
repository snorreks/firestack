import type { AuthUserRecord } from 'firebase-functions/v2/identity';
import type {
  AuthEventContext,
  BeforeCreateResponse,
  BeforeSignInResponse,
  IdentityTriggerOptions,
} from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { createAuthEventHandler } from './factory.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

export const beforeEmailSent = createAuthEventHandler<
  AuthUserRecord,
  AuthEventContext,
  IdentityTriggerOptions
>('identity.beforeEmailSent', () => crypto.randomUUID());

export const beforeSmsSent = createAuthEventHandler<
  AuthUserRecord,
  AuthEventContext,
  IdentityTriggerOptions
>('identity.beforeSmsSent', () => crypto.randomUUID());

/**
 * Blocks request to create a Firebase Auth user (v2 identity).
 * @typeParam TCustomClaims - Optional type for custom claims added to the user token.
 */
export const beforeUserCreated = <TCustomClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) =>
    | BeforeCreateResponse<TCustomClaims>
    | void
    | Promise<BeforeCreateResponse<TCustomClaims>>
    | Promise<void>,
  options?: IdentityTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) await batch.commit();
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'identity.beforeUserCreated',
      requestId: crypto.randomUUID(),
    })
  );
};

/**
 * Blocks request to sign-in a Firebase Auth user (v2 identity).
 */
export const beforeUserSignedIn = <TCustomClaims = never, TSessionClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) =>
    | BeforeSignInResponse<TCustomClaims, TSessionClaims>
    | void
    | Promise<BeforeSignInResponse<TCustomClaims, TSessionClaims>>
    | Promise<void>,
  options?: IdentityTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) await batch.commit();
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'identity.beforeUserSignedIn',
      requestId: crypto.randomUUID(),
    })
  );
};
