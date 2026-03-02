import type { UserData } from '@shared/types';
import { onCreated } from '@snorreks/firestack';

export default onCreated<UserData>(({ data }) => {
  console.log(`User ${data.email} created`);
});
