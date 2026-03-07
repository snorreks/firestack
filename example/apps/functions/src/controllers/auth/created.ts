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
  }
);
