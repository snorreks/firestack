import type { CoreData } from '@snorreks/firestack';

export interface UserData extends CoreData {
  email: string;
}

export type CallableFunctions = {
  test_callable: [
    {
      message: string;
    },
    {
      flavor?: string;
      dataFromSharedLib: string;
    },
  ];
};

export type RequestFunctions = {
  test_api: [
    {
      message: string;
    },
    {
      flavor?: string;
      dataFromSharedLib: string;
      test: string;
    },
  ];
};
