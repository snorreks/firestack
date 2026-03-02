import type { RequestFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { onRequest } from '@snorreks/firestack';

export default onRequest<RequestFunctions, 'test_api', { p: string }>(
  (request, response) => {
    console.log(`message ${request.body.message}`);
    console.log(`params ${request.params.p}`);

    response.send({
      dataFromSharedLib: test(),
      test: 'test',
    });
  },
  {
    region: 'europe-west1',
  }
);
