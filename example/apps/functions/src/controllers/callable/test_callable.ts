import type { CallableFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { FirestackError, onCall } from '@snorreks/firestack';

export default onCall<CallableFunctions, 'test_callable'>(({ data, auth }) => {
  console.log(`message ${data.message} from ${auth?.uid}`);

  if (data.message === 'error') {
    throw new FirestackError('invalid-argument', "Message cannot be 'error'");
  }

  return {
    dataFromSharedLib: test(),
  };
});
