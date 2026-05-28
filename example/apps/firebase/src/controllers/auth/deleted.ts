import { onAuthDelete } from '@snorreks/firestack';

export const onUserDeleted = onAuthDelete(
  async (user, context) => {
    console.log('User deleted', {
      uid: user.uid,
      email: user.email,
      deletedAt: context.timestamp,
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
