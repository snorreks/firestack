import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID environment variable not set');
}

const mode = process.env.FIREBASE_MODE;

console.log(`🚀 Initializing emulator (Project: ${projectId}, Mode: ${mode})...`);

const app = initializeApp({
  projectId: projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 1. Initialize Auth
console.log('👥 Creating sample users in Auth...');
try {
  await auth.createUser({
    uid: 'user1',
    email: 'john@example.com',
    password: 'password123',
    displayName: 'John Doe',
  });
  await auth.createUser({
    uid: 'user2',
    email: 'jane@example.com',
    password: 'password123',
    displayName: 'Jane Smith',
  });
} catch (error) {
  const authError = error as { code?: string };
  if (authError.code !== 'auth/uid-already-exists') {
    console.error('❌ Error creating Auth users:', error);
  }
}

// 2. Initialize Firestore
console.log('📄 Creating sample documents in Firestore...');
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

// 3. Initialize Storage
console.log('📦 Uploading sample assets to Storage...');
try {
  const bucket = storage.bucket();
  // asset path is relative to the project root (where the command is run)
  const assetPath = join(process.cwd(), 'src/assets/image.avif');
  const assetBuffer = readFileSync(assetPath);

  await bucket.file('assets/image.avif').save(assetBuffer, {
    metadata: { contentType: 'image/avif' },
  });
} catch (error) {
  console.error('❌ Error uploading Storage assets:', error);
}

console.log('✅ Emulator initialization complete.');
