import { beforeUserCreated } from '@snorreks/firestack';

type CustomClaims = {
  role: 'admin' | 'user';
  subscription: 'free' | 'pro' | 'enterprise';
};

/**
 * Identity v2 — blocks user creation and assigns custom claims.
 *
 * Users from @example.com are blocked. All others receive role-based
 * custom claims stored in the ID token.
 */
export default beforeUserCreated<CustomClaims>(
  async (user, context) => {
    console.log('Identity: beforeUserCreated', {
      uid: user.uid,
      email: user.email,
      ipAddress: context.ipAddress,
    });

    // Block users from a restricted domain
    if (user.email?.endsWith('@example.com')) {
      throw new Error('User registration is restricted for this domain.');
    }

    return {
      customClaims: {
        role: 'user',
        subscription: 'free',
      },
      displayName: user.displayName ?? user.email?.split('@')[0],
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'identity_before_user_created',
  }
);
