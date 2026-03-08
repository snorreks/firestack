import { onAuthCreate } from '@snorreks/firestack';

export default onAuthCreate(
  async (user, context) => {
    console.log('User created', {
      uid: user.uid,
      email: user.email,
      createdAt: context.timestamp,
    });

    return {
      success: true,
      uid: user.uid,
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'auth_created_renamed',
    nodeVersion: '20',
    assets: ['src/assets/image.avif'],
    external: ['is-thirteen'],
  }
);
