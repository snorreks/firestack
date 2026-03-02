import type { CallableFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { onCall } from '@snorreks/firestack';
// import { flavor } from "$configs/environment.ts";

export default onCall<CallableFunctions, 'test_callable'>(({ data, auth }) => {
  console.log(`message ${data.message} from ${auth?.uid}`);

  return {
    dataFromSharedLib: test(),
    // flavor,
  };
});
