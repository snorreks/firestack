import { onDocumentDeleted } from 'firebase-functions/firestore';
import functionStart from '../../src/controllers/firestore/users/[uid]/deleted.ts';

export const deleted = onDocumentDeleted({}, functionStart);
