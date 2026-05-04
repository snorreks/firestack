import { test2 } from '@shared/utils';
import { test } from '@shared/utils/test';

import { onSchedule } from '@snorreks/firestack';

export default onSchedule(
  (context) => {
    console.log('daily', context);
    console.log('test', test());
    console.log('test2', test2());
  },
  {
    schedule: 'every day 00:00',
    timeoutSeconds: 540,
    memory: '1GiB',
  }
);
