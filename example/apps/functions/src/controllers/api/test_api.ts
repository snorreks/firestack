import process from 'node:process';

import type { RequestFunctions } from '@shared/types';
import { test } from '@shared/utils';
import { FirestackError, onRequest, setLogContext } from '@snorreks/firestack';
import { getFirestore } from '$configs/database.ts';
import { logger } from '$logger';

export default onRequest<RequestFunctions, 'test_api', { p: string }>(
  async (request, response) => {
    const mode = process.env.MODE;

    // Enrich the automatic log context with business-specific fields
    setLogContext({
      companyId: request.body.companyId,
      userId: request.body.userId,
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
