import { test2 } from '@shared/utils';
import { test } from '@shared/utils/test';

import { onSchedule } from '@snorreks/firestack';

/**
 * Scheduler — demonstrates batch for daily maintenance tasks.
 *
 * Each nightly task runs concurrently. Auto-commit ensures all tasks
 * complete before the function invocation ends.
 */
export default onSchedule(
  async ({ batch, ...context }) => {
    console.log('Running daily maintenance', context);

    batch.push(async () => {
      console.log('Cleaning up expired sessions');
      // In a real app: await firestore.recursiveDelete(...)
    });

    batch.push(async () => {
      console.log('Generating daily report');
      // In a real app: await generateReport()
    });

    batch.push(async () => {
      console.log('Syncing external data');
      // In a real app: await syncExternalApi()
    });

    // Synchronous work still happens inline
    console.log('test', test());
    console.log('test2', test2());
  },
  {
    schedule: 'every day 00:00',
    timeoutSeconds: 540,
    memory: '1GiB',
  }
);
