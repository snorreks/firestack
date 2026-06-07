import type { UserData } from '@shared/types';
import { onUpdated } from '@snorreks/firestack';

/**
 * Firestore onUpdated trigger — demonstrates batch for conditional async work.
 *
 * When user fields change, unrelated side-effects (notifications, analytics,
 * audit logs) can be batched and executed concurrently after the handler
 * returns. No manual commit needed — firestack auto-commits.
 */
export default onUpdated<UserData>(({ data, batch }) => {
  const { before: beforeUser, after: afterUser } = data;

  console.log(`User ${beforeUser.email} updated to ${afterUser.email}`);

  // Simulated side-effects — in a real app these would be Firestore writes,
  // Auth claim updates, or 3rd-party API calls
  if (beforeUser.email !== afterUser.email) {
    batch.push(async () => {
      console.log(`Sending email change notification to ${afterUser.email}`);
    });
  }

  batch.push(async () => {
    console.log(`Logging user update audit trail for ${afterUser.id}`);
  });
});
