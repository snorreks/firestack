import { beforeAll, beforeEach, describe, test } from 'bun:test';
import { assertFails, assertSucceeds, rulesTest } from '@snorreks/firestack/testing';

const hasEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const describeOrSkip = hasEmulator ? describe : describe.skip;

describeOrSkip('firestore.rules', () => {
  type RulesTestHelpers = Awaited<ReturnType<typeof rulesTest.firestore>>;

  let testHelpers: RulesTestHelpers;

  beforeAll(async () => {
    testHelpers = await rulesTest.firestore();
  });

  beforeEach(async () => {
    await testHelpers.clearFirestore();
  });

  test('unauthenticated user cannot read any document by default', async () => {
    const db = testHelpers.withoutAuth().firestore();
    await assertFails(db.collection('secrets').doc('x').get());
  });

  test('unauthenticated user cannot write any document by default', async () => {
    const db = testHelpers.withoutAuth().firestore();
    await assertFails(db.collection('secrets').doc('x').set({ value: 1 }));
  });

  test('authenticated user can read their own user document', async () => {
    const db = testHelpers.withAuth('user-123').firestore();
    await assertSucceeds(db.collection('users').doc('user-123').get());
  });

  test('authenticated user can write their own user document', async () => {
    const db = testHelpers.withAuth('user-123').firestore();
    await assertSucceeds(db.collection('users').doc('user-123').set({ name: 'Alice' }));
  });

  test('authenticated user cannot write another user document', async () => {
    const db = testHelpers.withAuth('user-456').firestore();
    await assertFails(db.collection('users').doc('user-123').set({ name: 'Hacker' }));
  });

  test('anyone can read posts', async () => {
    const db = testHelpers.withoutAuth().firestore();
    await assertSucceeds(db.collection('posts').doc('post-1').get());
  });

  test('authenticated user can create a post', async () => {
    const db = testHelpers.withAuth('author-1').firestore();
    await assertSucceeds(
      db.collection('posts').doc('post-1').set({
        title: 'Hello',
        authorId: 'author-1',
      })
    );
  });

  test('unauthenticated user cannot create a post', async () => {
    const db = testHelpers.withoutAuth().firestore();
    await assertFails(
      db.collection('posts').doc('post-1').set({
        title: 'Hello',
        authorId: 'anonymous',
      })
    );
  });

  test('author can update their own post', async () => {
    const db = testHelpers.withAuth('author-1').firestore();
    await db.collection('posts').doc('post-1').set({
      title: 'Original',
      authorId: 'author-1',
    });
    await assertSucceeds(db.collection('posts').doc('post-1').update({ title: 'Updated' }));
  });

  test('non-author cannot update a post', async () => {
    const authorDb = testHelpers.withAuth('author-1').firestore();
    await authorDb.collection('posts').doc('post-1').set({
      title: 'Original',
      authorId: 'author-1',
    });

    const otherDb = testHelpers.withAuth('hacker').firestore();
    await assertFails(otherDb.collection('posts').doc('post-1').update({ title: 'Hacked' }));
  });

  test('author can delete their own post', async () => {
    const db = testHelpers.withAuth('author-1').firestore();
    await db.collection('posts').doc('post-1').set({
      title: 'To Delete',
      authorId: 'author-1',
    });
    await assertSucceeds(db.collection('posts').doc('post-1').delete());
  });

  test('non-author cannot delete a post', async () => {
    const authorDb = testHelpers.withAuth('author-1').firestore();
    await authorDb.collection('posts').doc('post-1').set({
      title: 'Important',
      authorId: 'author-1',
    });

    const otherDb = testHelpers.withAuth('hacker').firestore();
    await assertFails(otherDb.collection('posts').doc('post-1').delete());
  });
});
