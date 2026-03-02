import type { UserData } from '@shared/types';
import { onDeleted } from '@snorreks/firestack';

export default onDeleted<UserData>(({ data }) => {
  console.log(`User ${data.email} created`);
});
