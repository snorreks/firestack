import { z } from 'zod';

/**
 * The base schema for all Firestore documents.
 * Every document processed through firestack will have an `id` field.
 */
export const CoreSchema = z.object({
  /**
   * The document's ID
   *
   * @see https://firebase.google.com/docs/reference/node/firebase.firestore.DocumentSnapshot#id
   */
  id: z.string(),
});
