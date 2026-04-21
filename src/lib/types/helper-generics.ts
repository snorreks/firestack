import type z from 'zod';
import type { CoreSchema } from '$constants';

export type CallableFunctions = {
  [key: string]: [unknown, unknown];
};

export type RequestFunctions = {
  [key: string]: [
    {
      [key: string]: unknown;
    },
    unknown,
  ];
};

export type CoreData = z.infer<typeof CoreSchema>;
