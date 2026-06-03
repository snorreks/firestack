import type { AuthUserRecord } from 'firebase-functions/v2/identity';

export type AuthEventContext = {
  eventId: string;
  eventType: string;
  resource: string;
  timestamp: string;
  params: { [key: string]: string };
  auth: {
    token: object;
    uid: string;
  };
  data: AuthUserRecord;
};

export type BeforeCreateResponse<TCustomClaims = never> = {
  customClaims: [TCustomClaims] extends [never] ? object | undefined : TCustomClaims;
  disabled?: boolean;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  phoneNumber?: string;
  photoURL?: string;
};

export type BeforeSignInResponse<TCustomClaims = never, TSessionClaims = never> = {
  customClaims: [TCustomClaims] extends [never] ? object | undefined : TCustomClaims;
  sessionClaims: [TSessionClaims] extends [never] ? object | undefined : TSessionClaims;
};
