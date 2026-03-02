import { onDocumentCreated } from 'firebase-functions/firestore';
import functionStart from '../../src/controllers/firestore/users/[uid]/created.ts';

export const created = onDocumentCreated({}, functionStart);
