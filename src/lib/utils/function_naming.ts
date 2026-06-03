import { relative } from 'node:path';

/**
 * Derives a function name from a file path relative to the controllers directory.
 *
 * Sanitizes the name to comply with Firebase function naming rules:
 * - Converts all hyphens (`-`) to underscores (`_`)
 * - Replaces any other invalid characters with `_`
 * - Collapses consecutive underscores
 * - Ensures the name starts with a letter
 * - Truncates to 63 characters
 *
 * Examples:
 * - `api/test_api.ts` → `test_api`
 * - `api/check-email.ts` → `check_email`
 * - `firestore/users/[uid]/created.ts` → `users_created`
 * - `scheduler/daily.ts` → `daily`
 * - `auth/created.ts` → `created` (auth triggers don't get a prefix)
 * - `api/user.profile.ts` → `user_profile`
 *
 * @param options - The options containing file paths.
 * @returns The derived function name.
 */
export const deriveFunctionName = (options: {
  functionPath: string;
  functionsDirectoryPath: string;
}): string => {
  const { functionPath, functionsDirectoryPath } = options;
  const relativePath = relative(functionsDirectoryPath, functionPath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  // Remove file extension from the last part
  const fileName = parts[parts.length - 1].replace(/\.(ts|tsx|js)$/, '');

  // Remove the first part (trigger type like 'firestore', 'api', 'auth', etc.)
  const pathParts = parts.slice(1, -1);

  // Filter out [id] placeholders and build the name
  const nameParts = pathParts.filter((part) => !part.startsWith('[')).concat(fileName);

  const functionName = nameParts
    .join('_')
    // Convert hyphens to underscores
    .replace(/-/g, '_')
    // Replace any character not valid for Firebase function names with underscore
    .replace(/[^a-zA-Z0-9_]/g, '_')
    // Collapse consecutive underscores
    .replace(/_+/g, '_')
    // Trim leading/trailing underscores
    .replace(/^_|_$/g, '');

  // Firebase function names must start with a letter
  if (functionName.length > 0 && !/^[a-zA-Z]/.test(functionName)) {
    return `fn_${functionName}`.slice(0, 63);
  }

  return functionName.slice(0, 63) || 'unnamed';
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
export const extractDocumentPath = (options: {
  functionPath: string;
  functionsDirectoryPath: string;
}): string | undefined => {
  const { functionPath, functionsDirectoryPath } = options;
  const relativePath = relative(functionsDirectoryPath, functionPath);
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

/**
 * Extracts a database reference path from a file path.
 *
 * @param options - The options containing file paths.
 * @returns The database reference path, or undefined if not a database trigger.
 */
export const extractDatabaseRef = (options: {
  functionPath: string;
  functionsDirectoryPath: string;
}): string | undefined => {
  const { functionPath, functionsDirectoryPath } = options;
  const relativePath = relative(functionsDirectoryPath, functionPath);
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
