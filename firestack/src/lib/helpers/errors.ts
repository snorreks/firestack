import type { FunctionsErrorCode } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';

export { HttpsError };

export const HttpStatusCode: Record<FunctionsErrorCode, number> = {
  ok: 200,
  cancelled: 499,
  unknown: 500,
  'invalid-argument': 400,
  'deadline-exceeded': 504,
  'not-found': 404,
  'already-exists': 409,
  'permission-denied': 403,
  'resource-exhausted': 429,
  'failed-precondition': 400,
  aborted: 409,
  'out-of-range': 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  'data-loss': 500,
  unauthenticated: 401,
};

/**
 * Custom error class for Firestack that can be used in both onRequest and onCall.
 * When thrown in onCall, it will be automatically converted to HttpsError.
 * When thrown in onRequest, it will be caught and the response will be sent with the corresponding status code.
 */
export class FirestackError extends HttpsError {
  constructor(
    code: FunctionsErrorCode,
    message: string,
    public override details: unknown = undefined
  ) {
    super(code, message, details);
  }
}
