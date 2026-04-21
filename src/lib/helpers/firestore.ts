import type { ParamsOf } from 'firebase-functions/v2/core';
import type {
  Change,
  DocumentSnapshot,
  FirestoreEvent,
  QueryDocumentSnapshot,
} from 'firebase-functions/v2/firestore';
import type { z } from 'zod';
import type { CoreData, DocumentOptions, ZodOptions } from '$types';
import { handleZodError } from '$utils/zod.ts';

/** Respond only to document creations. */
export const onDocumentCreated = <Document extends string = string>(
  handler: (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => handler;

/** Respond only to document deletions. */
export const onDocumentDeleted = <Document extends string = string>(
  handler: (
    event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => handler;

/** Respond only to document updates. */
export const onDocumentUpdated = <Document extends string = string>(
  handler: (
    event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => handler;

/** Respond to all document writes (creates, updates, or deletes). */
export const onDocumentWritten = <Document extends string = string>(
  handler: (
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<Document>>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => handler;

/** Respond only to document creations. */
export const onCreated = <T extends CoreData>(
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => {
  return (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => {
    if (!event.data) {
      throw new Error('No data found in event');
    }

    return handler({
      ...event,
      data: toCoreData<T>(event.data),
    });
  };
};

/** Respond only to document creations with Zod validation. */
export const onCreatedZod = <T extends CoreData>(
  schema: z.ZodSchema<T>,
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions & ZodOptions
) => {
  return (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => {
    if (!event.data) {
      throw new Error('No data found in event');
    }

    const data = toCoreData<T>(event.data);
    const result = schema.safeParse(data);

    if (!result.success) {
      handleZodError({
        error: result.error,
        ...options,
      });
      if (options?.validationStrategy === 'ignore') {
        return;
      }
    }

    return handler({
      ...event,
      data: result.success ? result.data : data,
    });
  };
};

/** Respond only to document deletions. */
export const onDeleted = <T extends CoreData>(
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => {
  return (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => {
    if (!event.data) {
      throw new Error('No data found in event');
    }

    return handler({
      ...event,
      data: toCoreData<T>(event.data),
    });
  };
};

/** Respond only to document deletions with Zod validation. */
export const onDeletedZod = <T extends CoreData>(
  schema: z.ZodSchema<T>,
  handler: (event: FirestoreEvent<T>) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions & ZodOptions
) => {
  return (event: FirestoreEvent<QueryDocumentSnapshot | undefined, ParamsOf<string>>) => {
    if (!event.data) {
      throw new Error('No data found in event');
    }

    const data = toCoreData<T>(event.data);
    const result = schema.safeParse(data);

    if (!result.success) {
      handleZodError({
        error: result.error,
        ...options,
      });
      if (options?.validationStrategy === 'ignore') {
        return;
      }
    }

    return handler({
      ...event,
      data: result.success ? result.data : data,
    });
  };
};

/** Respond only to document updates. */
export const onUpdated = <T extends CoreData>(
  handler: (
    event: FirestoreEvent<{
      before: T;
      after: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => {
  return (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, ParamsOf<string>>) => {
    if (!event.data?.after || !event.data?.before) {
      throw new Error('No data found in event');
    }

    return handler({
      ...event,
      data: {
        before: toCoreData<T>(event.data.before),
        after: toCoreData<T>(event.data.after),
      },
    });
  };
};

/** Respond only to document updates with Zod validation. */
export const onUpdatedZod = <T extends CoreData>(
  schema: z.ZodSchema<T>,
  handler: (
    event: FirestoreEvent<{
      before: T;
      after: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions & ZodOptions
) => {
  return (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, ParamsOf<string>>) => {
    if (!event.data?.after || !event.data?.before) {
      throw new Error('No data found in event');
    }

    const before = toCoreData<T>(event.data.before);
    const after = toCoreData<T>(event.data.after);

    const beforeResult = schema.safeParse(before);
    const afterResult = schema.safeParse(after);

    if (!beforeResult.success) {
      handleZodError({
        error: beforeResult.error,
        ...options,
        context: 'before',
      });
    }
    if (!afterResult.success) {
      handleZodError({
        error: afterResult.error,
        ...options,
        context: 'after',
      });
    }

    if (
      options?.validationStrategy === 'ignore' &&
      (!beforeResult.success || !afterResult.success)
    ) {
      return;
    }

    return handler({
      ...event,
      data: {
        before: beforeResult.success ? beforeResult.data : before,
        after: afterResult.success ? afterResult.data : after,
      },
    });
  };
};

/** Respond to all document writes (creates, updates, or deletes). */
export const onWritten = <T extends CoreData>(
  handler: (
    event: FirestoreEvent<{
      before?: T;
      after?: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  _options?: DocumentOptions
) => {
  return (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) => {
    return handler({
      ...event,
      data: {
        before: event.data?.before ? toCoreData<T>(event.data.before) : undefined,
        after: event.data?.after ? toCoreData<T>(event.data.after) : undefined,
      },
    });
  };
};

/** Respond to all document writes with Zod validation. */
export const onWrittenZod = <T extends CoreData>(
  schema: z.ZodSchema<T>,
  handler: (
    event: FirestoreEvent<{
      before?: T;
      after?: T;
    }>
  ) => PromiseLike<unknown> | unknown,
  options?: DocumentOptions & ZodOptions
) => {
  return (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) => {
    const before = event.data?.before ? toCoreData<T>(event.data.before) : undefined;
    const after = event.data?.after ? toCoreData<T>(event.data.after) : undefined;

    let beforeData = before;
    let afterData = after;

    if (before) {
      const result = schema.safeParse(before);
      if (!result.success) {
        handleZodError({
          error: result.error,
          ...options,
          context: 'before',
        });
        if (options?.validationStrategy === 'ignore') {
          beforeData = undefined;
        }
      } else {
        beforeData = result.data;
      }
    }

    if (after) {
      const result = schema.safeParse(after);
      if (!result.success) {
        handleZodError({
          error: result.error,
          ...options,
          context: 'after',
        });
        if (options?.validationStrategy === 'ignore') {
          afterData = undefined;
        }
      } else {
        afterData = result.data;
      }
    }

    return handler({
      ...event,
      data: {
        before: beforeData,
        after: afterData,
      },
    });
  };
};

const toCoreData = <T extends CoreData>(documentSnap: DocumentSnapshot): T =>
  ({
    ...documentSnap.data(),
    id: documentSnap.id,
  }) as T;
