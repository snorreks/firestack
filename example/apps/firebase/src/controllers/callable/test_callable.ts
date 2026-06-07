import type { CallableFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { FirestackError, onCall } from '@snorreks/firestack';

/**
 * Callable function — demonstrates batch with checkpoint-style commit.
 *
 * Phase 1 (validation) runs inline. Phase 2 (side-effects) is batched
 * and auto-commits after the response is returned.
 */
export default onCall<CallableFunctions, 'test_callable'>(({ data, auth, batch }) => {
  console.log(`message ${data.message} from ${auth?.uid}`);

  if (data.message === 'error') {
    throw new FirestackError('invalid-argument', "Message cannot be 'error'");
  }

  // Queue concurrent post-call tasks
  batch.push(async () => {
    console.log('Logging callable invocation');
  });

  batch.push(async () => {
    console.log('Updating user activity timestamp');
  });

  return {
    dataFromSharedLib: test(),
  };
});
