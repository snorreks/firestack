import type { UserData } from '@shared/types';
import { onUpdated } from '@snorreks/firestack';

export default onUpdated<UserData>(({ data }) => {
  const beforeUser = data.before;
  const afterUser = data.after;
  console.log(`User ${beforeUser.email} updated to ${afterUser.email}`);
});
