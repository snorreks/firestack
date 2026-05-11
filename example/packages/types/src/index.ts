import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

export type UserData = z.infer<typeof UserSchema>;

export type CallableFunctions = {
  test_callable: [
    {
      message: string;
    },
    {
      mode?: string;
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
      mode?: string;
      dataFromSharedLib: string;
      test: string;
    },
  ];
};
