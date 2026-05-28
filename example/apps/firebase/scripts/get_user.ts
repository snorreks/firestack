import { getFirestore } from '$configs/database.ts';

const uid = prompt('Enter the user ID to fetch:');

if (!uid) {
  throw new Error('User ID cannot be empty.');
}

const firestore = getFirestore();

const userDoc = await firestore.collection('npcs').doc(uid).get();
if (!userDoc.exists) {
  throw new Error('User not found');
}

console.log({ id: userDoc.id, ...userDoc.data() });
