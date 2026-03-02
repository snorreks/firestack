import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface InitContext {
  projectId: string;
}

export default async function (context: InitContext): Promise<void> {
  console.log('Initializing Firestore for emulation...');

  const app = initializeApp({
    projectId: context.projectId,
  });

  const db = getFirestore(app);

  // Create sample users
  const usersCollection = db.collection('users');

  await usersCollection.doc('user1').set({
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
  });

  await usersCollection.doc('user2').set({
    name: 'Jane Smith',
    email: 'jane@example.com',
    createdAt: new Date(),
  });

  console.log('Sample users created successfully!');
  console.log('- user1: John Doe (john@example.com)');
  console.log('- user2: Jane Smith (jane@example.com)');
}
