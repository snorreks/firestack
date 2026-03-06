/**
 * @file Utilities for deriving function names and document paths from file paths.
 * @license MIT
 */

import { relative } from 'node:path';

/**
 * Derives a function name from a file path relative to the controllers directory.
 *
 * Examples:
 * - `api/test_api.ts` → `test_api`
 * - `firestore/users/[uid]/created.ts` → `users_created`
 * - `scheduler/daily.ts` → `daily`
 *
 * @param funcPath The absolute path to the function file.
 * @param controllersPath The absolute path to the controllers directory.
 * @returns The derived function name.
 */
export function deriveFunctionName(funcPath: string, controllersPath: string): string {
  const relativePath = relative(controllersPath, funcPath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  // Remove file extension from the last part
  const fileName = parts[parts.length - 1].replace(/\.(ts|tsx|js)$/, '');

  // Remove the first part (trigger type like 'firestore', 'api', etc.)
  const pathParts = parts.slice(1, -1);

  // Filter out [id] placeholders and build the name
  const nameParts = pathParts.filter((part) => !part.startsWith('[')).concat(fileName);

  return nameParts.join('_');
}

/**
 * Extracts a Firestore document path from a file path.
 *
 * Examples:
 * - `firestore/users/[uid]/created.ts` → `users/{uid}`
 * - `firestore/users/[uid]/notifications/[notificationId]/created.ts` → `users/{uid}/notifications/{notificationId}`
 *
 * @param funcPath The absolute path to the function file.
 * @param controllersPath The absolute path to the controllers directory.
 * @returns The Firestore document path, or undefined if not a Firestore trigger.
 */
export function extractDocumentPath(funcPath: string, controllersPath: string): string | undefined {
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
}

/**
 * Extracts a database reference path from a file path.
 *
 * @param funcPath The absolute path to the function file.
 * @param controllersPath The absolute path to the controllers directory.
 * @returns The database reference path, or undefined if not a database trigger.
 */
export function extractDatabaseRef(funcPath: string, controllersPath: string): string | undefined {
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
}
