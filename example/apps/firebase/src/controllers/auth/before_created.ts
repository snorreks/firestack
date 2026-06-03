import { beforeAuthCreate } from '@snorreks/firestack';

type CustomClaims = {
  role: 'admin' | 'user';
  tier: number;
  organizationId: string;
};

export default beforeAuthCreate<CustomClaims>(
  async (user, context) => {
    console.log('Before user created', {
      uid: user.uid,
      email: user.email,
    });

    return {
      customClaims: {
        role: 'user',
        tier: 1,
        organizationId: context.params?.organizationId ?? 'default',
      },
      displayName: user.displayName ?? user.email?.split('@')[0],
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'auth_before_created_renamed',
    nodeVersion: '20',
    assets: ['src/assets/image.avif'],
    external: ['is-thirteen'],
  }
);
