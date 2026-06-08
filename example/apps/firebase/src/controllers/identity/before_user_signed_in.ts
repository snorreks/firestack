import { beforeUserSignedIn } from '@snorreks/firestack';

type CustomClaims = {
  role: 'admin' | 'user';
  subscription: 'free' | 'pro' | 'enterprise';
};

type SessionClaims = {
  lastLoginIp?: string;
};

/**
 * Identity v2 — blocks user sign-in and enriches the token with session claims.
 *
 * Disabled users are blocked from signing in. Session claims are populated
 * with metadata scoped to this session only.
 */
export default beforeUserSignedIn<CustomClaims, SessionClaims>(
  async (user, context) => {
    console.log('Identity: beforeUserSignedIn', {
      uid: user.uid,
      email: user.email,
      ipAddress: context.ipAddress,
    });

    // Block disabled users
    if (user.disabled) {
      throw new Error('User account is disabled.');
    }

    return {
      customClaims: {
        role: user.customClaims?.role ?? 'user',
        subscription: user.customClaims?.subscription ?? 'free',
      },
      sessionClaims: {
        lastLoginIp: context.ipAddress,
      },
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'identity_before_user_signed_in',
  }
);
