import process from 'node:process';

import type { RequestFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { FirestackError, onRequest, setLogContext } from '@snorreks/firestack';
import { getFirestore } from '$configs/database.ts';
import { logger } from '$logger';

/**
 * HTTP onRequest — demonstrates batch for fire-and-forget side-effects.
 *
 * After sending the response, batched tasks continue asynchronously.
 * The response is sent first, then the batch auto-commits.
 */
export default onRequest<RequestFunctions, 'test_api', { p: string }>(
  async (request, response) => {
    const mode = process.env.MODE;

    setLogContext({
      message: request.body.message,
    });

    logger.info('Handling test_api request', {
      mode,
      message: request.body.message,
      params: request.params.p,
    });

    const firestore = getFirestore();
    logger.debug('Firestore instance retrieved', !!firestore);

    if (request.body.message === 'error') {
      logger.error('Invalid message received', { message: request.body.message });
      throw new FirestackError('invalid-argument', "Message cannot be 'error'");
    }

    // Queue async side-effects — they execute after the response is sent
    request.batch.push(async () => {
      logger.info('Post-response analytics tracking');
    });

    request.batch.push(async () => {
      logger.info('Updating usage counters');
    });

    await logger.flush();

    response.send({
      dataFromSharedLib: test(),
      test: 'test',
      mode,
    });
  },
  {
    region: 'europe-west1',
  }
);
