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

export type BeforeCreateResponse = {
  customClaims?: object;
  disabled?: boolean;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  phoneNumber?: string;
  photoURL?: string;
};

export type BeforeSignInResponse = {
  customClaims?: object;
  sessionClaims?: object;
};
