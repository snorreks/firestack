import type { AuthUserRecord } from 'firebase-functions/v2/identity';
import type {
  AuthEventContext,
  BeforeCreateResponse,
  BeforeEmailResponse,
  BeforeSignInResponse,
  BeforeSmsResponse,
  IdentityTriggerOptions,
} from '$types';
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

/**
 * Blocks request to create a Firebase Auth user (v2 identity).
 *
 * @param handler Event handler that blocks creation of a Firebase Auth user.
 * @typeParam TCustomClaims - Optional type for custom claims added to the user token.
 *   When provided, `customClaims` becomes required in the response.
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
      if (!batch.isEmpty) {
        await batch.commit();
      }
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
 *
 * @param handler Event handler that blocks sign-in of a Firebase Auth user.
 * @typeParam TCustomClaims - Optional type for custom claims added to the ID token.
 *   When provided, `customClaims` becomes required in the response.
 * @typeParam TSessionClaims - Optional type for session claims scoped to the current session.
 *   When provided, `sessionClaims` becomes required in the response.
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
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'identity.beforeUserSignedIn',
      requestId: crypto.randomUUID(),
    })
  );
};

/**
 * Blocks sending an email to a Firebase Auth user (v2 identity).
 *
 * Handles sign-in email and password reset email events. Use this to control
 * whether emails are delivered based on reCAPTCHA evaluation or custom logic.
 *
 * @param handler Event handler that runs before an email is sent to a user.
 */
export const beforeEmailSent = (
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) => BeforeEmailResponse | void | Promise<BeforeEmailResponse> | Promise<void>,
  options?: IdentityTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'identity.beforeEmailSent',
      requestId: crypto.randomUUID(),
    })
  );
};

/**
 * Blocks sending an SMS to a Firebase Auth user (v2 identity).
 *
 * Handles sign-in/sign-up SMS, multi-factor sign-in SMS, and multi-factor
 * enrollment SMS events. Use this to control whether SMS messages are delivered
 * based on reCAPTCHA evaluation or custom logic.
 *
 * @param handler Event handler that runs before an SMS is sent to a user.
 */
export const beforeSmsSent = (
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext & { batch: Batch }
  ) => BeforeSmsResponse | void | Promise<BeforeSmsResponse> | Promise<void>,
  options?: IdentityTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (user: AuthUserRecord, context: AuthEventContext) => {
      const batch = createBatch({ concurrency });
      const result = await handler(user, { ...context, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    () => ({
      source: 'functions' as const,
      trigger: 'identity.beforeSmsSent',
      requestId: crypto.randomUUID(),
    })
  );
};
