import type { FirestackScriptContext } from '@snorreks/firestack';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function run(context: FirestackScriptContext): Promise<void> {
  console.log(`Initializing Firestore for emulation (Project: ${context.projectId})...`);
  console.log(`FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST}`);

  const app = initializeApp({
    projectId: context.projectId,
  });

  const db = getFirestore(app);

  // Create sample users
  console.log('Attempting to create user1...');
  const usersCollection = db.collection('users');

  try {
    await usersCollection.doc('user1').set({
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date(),
    });
    console.log('user1 created.');

    await usersCollection.doc('user2').set({
      name: 'Jane Smith',
      email: 'jane@example.com',
      createdAt: new Date(),
    });
    console.log('user2 created.');

    console.log('Sample users created successfully!');
    console.log('- user1: John Doe (john@example.com)');
    console.log('- user2: Jane Smith (jane@example.com)');
  } catch (error) {
    console.error('Error creating sample users:', error);
    throw error;
  }
}

if (import.meta.main) {
  run({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
    flavor: process.env.FIREBASE_FLAVOR || '',
  }).catch((error) => {
    console.error('Failed to run init script:', error);
    process.exit(1);
  });
}

export default run;
