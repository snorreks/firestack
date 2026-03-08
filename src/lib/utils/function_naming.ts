/**
 * @file Utilities for deriving function names and document paths from file paths.
 * @license MIT
 */

import { relative } from 'node:path';

type DeriveFunctionNameOptions = {
  funcPath: string;
  controllersPath: string;
};

/**
 * Derives a function name from a file path relative to the controllers directory.
 *
 * Examples:
 * - `api/test_api.ts` → `test_api`
 * - `firestore/users/[uid]/created.ts` → `users_created`
 * - `scheduler/daily.ts` → `daily`
 *
 * @param options - The options containing file paths.
 * @returns The derived function name.
 */
export const deriveFunctionName = (options: DeriveFunctionNameOptions): string => {
  const { funcPath, controllersPath } = options;
  const relativePath = relative(controllersPath, funcPath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  // Check if this is an auth trigger
  const isAuthTrigger = parts[0] === 'auth';

  // Remove file extension from the last part
  const fileName = parts[parts.length - 1].replace(/\.(ts|tsx|js)$/, '');

  // Remove the first part (trigger type like 'firestore', 'api', etc.)
  const pathParts = parts.slice(1, -1);

  // Filter out [id] placeholders and build the name
  const nameParts = pathParts.filter((part) => !part.startsWith('[')).concat(fileName);

  const functionName = nameParts.join('_');

  // Auto prefix with auth_ if it's an auth trigger
  if (isAuthTrigger) {
    return `auth_${functionName}`;
  }

  return functionName;
};

type ExtractDocumentPathOptions = {
  funcPath: string;
  controllersPath: string;
};

/**
 * Extracts a Firestore document path from a file path.
 *
 * Examples:
 * - `firestore/users/[uid]/created.ts` → `users/{uid}`
 * - `firestore/users/[uid]/notifications/[notificationId]/created.ts` → `users/{uid}/notifications/{notificationId}`
 *
 * @param options - The options containing file paths.
 * @returns The Firestore document path, or undefined if not a Firestore trigger.
 */
export const extractDocumentPath = (options: ExtractDocumentPathOptions): string | undefined => {
  const { funcPath, controllersPath } = options;
  const relativePath = relative(controllersPath, funcPath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  // Check if this is a firestore trigger
  if (parts[0] !== 'firestore') {
    return undefined;
  }

  // Get the path parts between 'firestore' and the filename
  const pathParts = parts.slice(1, -1);

  // Convert [id] to {id}
  const documentPath = pathParts
    .map((part) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return `{${part.slice(1, -1)}}`;
      }
      return part;
    })
    .join('/');

  return documentPath || undefined;
};

type ExtractDatabaseRefOptions = {
  funcPath: string;
  controllersPath: string;
};

/**
 * Extracts a database reference path from a file path.
 *
 * @param options - The options containing file paths.
 * @returns The database reference path, or undefined if not a database trigger.
 */
export const extractDatabaseRef = (options: ExtractDatabaseRefOptions): string | undefined => {
  const { funcPath, controllersPath } = options;
  const relativePath = relative(controllersPath, funcPath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  // Check if this is a database trigger
  if (parts[0] !== 'database') {
    return undefined;
  }

  // Get the path parts between 'database' and the filename
  const pathParts = parts.slice(1, -1);

  // Convert [id] to {id}
  const refPath = `/${pathParts
    .map((part) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return `{${part.slice(1, -1)}}`;
      }
      return part;
    })
    .join('/')}`;

  return refPath;
};
