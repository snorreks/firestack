import { onDocumentUpdated } from 'firebase-functions/firestore';
import functionStart from '../../src/controllers/firestore/users/[uid]/updated.ts';

export const updated = onDocumentUpdated({}, functionStart);
