import type { EventContext } from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-functions/v1/auth';
import type { AuthUserRecord } from 'firebase-functions/v2/identity';
import type {
  AuthEventContext,
  AuthTriggerOptions,
  BeforeCreateResponse,
  BeforeSignInResponse,
} from '$types';
import { wrapWithLogContext } from './logging.ts';

/**
 * Responds to the creation of a Firebase Auth user.
 *
 * @param handler Event handler that responds to the creation of a Firebase Auth
 *   user.
 */
export const onAuthCreate = (
  handler: (user: UserRecord, context: EventContext) => PromiseLike<unknown> | unknown,
  _options?: AuthTriggerOptions
) => {
  return wrapWithLogContext(handler, (_user, context) => ({
    source: 'functions' as const,
    trigger: 'auth.onCreate',
    requestId: context.eventId,
  }));
};
/**
 * Responds to the deletion of a Firebase Auth user.
 *
 * @param handler Event handler that responds to the deletion of a Firebase Auth
 *   user.
 */
export const onAuthDelete = (
  handler: (user: UserRecord, context: EventContext) => PromiseLike<unknown> | unknown,
  _options?: AuthTriggerOptions
) => {
  return wrapWithLogContext(handler, (_user, context) => ({
    source: 'functions' as const,
    trigger: 'auth.onDelete',
    requestId: context.eventId,
  }));
};
/**
 * Blocks request to create a Firebase Auth user.
 *
 * @param handler Event handler that blocks creation of a Firebase Auth user.
 * @typeParam TCustomClaims - Optional type for custom claims added to the user token.
 *   When provided, `customClaims` becomes required in the response.
 */
export const beforeAuthCreate = <TCustomClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext
  ) =>
    | BeforeCreateResponse<TCustomClaims>
    | void
    | Promise<BeforeCreateResponse<TCustomClaims>>
    | Promise<void>,
  _options?: AuthTriggerOptions
) => {
  return wrapWithLogContext(handler, () => ({
    source: 'functions' as const,
    trigger: 'auth.beforeCreate',
    requestId: crypto.randomUUID(),
  }));
};
/**
 * Blocks request to sign-in a Firebase Auth user.
 *
 * @param handler Event handler that blocks sign-in of a Firebase Auth user.
 * @typeParam TCustomClaims - Optional type for custom claims added to the ID token.
 *   When provided, `customClaims` becomes required in the response.
 * @typeParam TSessionClaims - Optional type for session claims scoped to the current session.
 *   When provided, `sessionClaims` becomes required in the response.
 */
export const beforeAuthSignIn = <TCustomClaims = never, TSessionClaims = never>(
  handler: (
    user: AuthUserRecord,
    context: AuthEventContext
  ) =>
    | BeforeSignInResponse<TCustomClaims, TSessionClaims>
    | void
    | Promise<BeforeSignInResponse<TCustomClaims, TSessionClaims>>
    | Promise<void>,
  _options?: AuthTriggerOptions
) => {
  return wrapWithLogContext(handler, () => ({
    source: 'functions' as const,
    trigger: 'auth.beforeSignIn',
    requestId: crypto.randomUUID(),
  }));
};
