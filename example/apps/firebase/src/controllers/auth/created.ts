import { onAuthCreate } from '@snorreks/firestack';

/**
 * Auth onCreate trigger — demonstrates batch for post-registration tasks.
 *
 * Welcome emails, analytics, and profile initialization can all be queued
 * in the batch and run concurrently after the handler returns.
 */
export default onAuthCreate(
  async (user, { batch, ...context }) => {
    console.log('User created', {
      uid: user.uid,
      email: user.email,
      createdAt: context.timestamp,
    });

    // Queue concurrent post-creation tasks — all fire at once with default
    // concurrency of 5
    batch.push(async () => {
      console.log(`Sending welcome email to ${user.email}`);
    });

    batch.push(async () => {
      console.log(`Initializing user profile for ${user.uid}`);
    });

    batch.push(async () => {
      console.log(`Tracking signup analytics for ${user.uid}`);
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
