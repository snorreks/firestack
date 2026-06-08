import type { AuthUserRecord } from 'firebase-functions/v2/identity';

/**
 * Types of emails handled by the identity platform.
 * - `EMAIL_SIGN_IN`: Sign-in email.
 * - `PASSWORD_RESET`: Password reset email.
 */
export type EmailType = 'EMAIL_SIGN_IN' | 'PASSWORD_RESET';

/**
 * Types of SMS messages handled by the identity platform.
 * - `SIGN_IN_OR_SIGN_UP`: Sign-in or sign-up SMS.
 * - `MULTI_FACTOR_SIGN_IN`: Multi-factor sign-in SMS.
 * - `MULTI_FACTOR_ENROLLMENT`: Multi-factor enrollment SMS.
 */
export type SmsType = 'SIGN_IN_OR_SIGN_UP' | 'MULTI_FACTOR_SIGN_IN' | 'MULTI_FACTOR_ENROLLMENT';

/** Additional user info available in identity blocking events. */
export type AdditionalUserInfo = {
  providerId?: string;
  profile?: Record<string, unknown>;
  username?: string;
  isNewUser: boolean;
  recaptchaScore?: number;
  email?: string;
  phoneNumber?: string;
};

/** Credential info available in identity blocking events. */
export type Credential = {
  claims?: Record<string, unknown>;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expirationTime?: string;
  secret?: string;
  providerId: string;
  signInMethod: string;
};

export type AuthEventContext = {
  eventId: string;
  eventType: string;
  resource: string;
  timestamp: string;
  params: { [key: string]: string };
  locale?: string;
  ipAddress: string;
  userAgent: string;
  additionalUserInfo?: AdditionalUserInfo;
  credential?: Credential;
  emailType?: EmailType;
  smsType?: SmsType;
  auth: {
    token: object;
    uid: string;
  };
  data: AuthUserRecord;
};

/**
 * Options for reCAPTCHA action override in identity blocking functions.
 * - `ALLOW`: Allow the action even if reCAPTCHA score is low.
 * - `BLOCK`: Block the action even if reCAPTCHA score is high.
 */
export type RecaptchaActionOptions = 'ALLOW' | 'BLOCK';

export type BeforeCreateResponse<TCustomClaims = never> = {
  customClaims: [TCustomClaims] extends [never] ? object | undefined : TCustomClaims;
  disabled?: boolean;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  phoneNumber?: string;
  photoURL?: string;
  recaptchaActionOverride?: RecaptchaActionOptions;
};

export type BeforeSignInResponse<TCustomClaims = never, TSessionClaims = never> = {
  customClaims: [TCustomClaims] extends [never] ? object | undefined : TCustomClaims;
  sessionClaims: [TSessionClaims] extends [never] ? object | undefined : TSessionClaims;
  recaptchaActionOverride?: RecaptchaActionOptions;
};

/**
 * Response type for `beforeEmailSent` blocking events.
 * Controls whether the email should be sent based on reCAPTCHA evaluation.
 */
export type BeforeEmailResponse = {
  recaptchaActionOverride?: RecaptchaActionOptions;
};

/**
 * Response type for `beforeSmsSent` blocking events.
 * Controls whether the SMS should be sent based on reCAPTCHA evaluation.
 */
export type BeforeSmsResponse = {
  recaptchaActionOverride?: RecaptchaActionOptions;
};
