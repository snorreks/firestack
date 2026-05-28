import { UserSchema } from '@shared/types';
import { onCreatedZod } from '@snorreks/firestack';

export default onCreatedZod(UserSchema, ({ data }) => {
  console.log(`User ${data.email} created`);
});
