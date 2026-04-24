/// <reference types="node" />
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { env as processEnv } from 'node:process';

type CreateRulesTestOptions = {
  projectId?: string;
};

/**
 * Parses a host:port string from environment variables.
 * @param envVar - The environment variable name.
 * @returns The host and port, or undefined.
 */
const parseHostPort = (envVar: string): { host: string; port: number } | undefined => {
  const value = processEnv[envVar];
  if (!value) {
    return undefined;
  }

  const [host, portStr] = value.split(':');
  if (!host || !portStr) {
    return undefined;
  }

  const port = Number.parseInt(portStr, 10);
  if (Number.isNaN(port)) {
    return undefined;
  }

  return { host, port };
};

/**
 * Creates a rules test helper connected to the running Firebase emulator.
 * Automatically discovers the emulator via environment variables
 * (FIRESTORE_EMULATOR_HOST, FIREBASE_STORAGE_EMULATOR_HOST, etc.).
 * @param options - Configuration options
 * @returns Test helpers for authenticated and unauthenticated contexts
 */
export const createRulesTest = async (options: CreateRulesTestOptions = {}) => {
  const { projectId = 'firestack-rules-test' } = options;

  const firestoreHostPort = parseHostPort('FIRESTORE_EMULATOR_HOST');
  const storageHostPort = parseHostPort('FIREBASE_STORAGE_EMULATOR_HOST');

  const env = await initializeTestEnvironment({
    projectId,
    firestore: firestoreHostPort ? { ...firestoreHostPort } : undefined,
    storage: storageHostPort ? { ...storageHostPort } : undefined,
  });

  return {
    /**
     * Returns a RulesTestContext authenticated as the given user.
     * @param uid - The user ID to authenticate as
     * @returns An authenticated test context
     */
    withAuth: (uid: string): RulesTestContext => env.authenticatedContext(uid),

    /**
     * Returns a RulesTestContext without authentication.
     * @returns An unauthenticated test context
     */
    withoutAuth: (): RulesTestContext => env.unauthenticatedContext(),

    /**
     * Clears all Firestore data for the test project.
     */
    clearFirestore: (): Promise<void> => env.clearFirestore(),

    /**
     * Clears all Storage data for the test project.
     */
    clearStorage: (): Promise<void> => env.clearStorage(),

    /**
     * Clears all Realtime Database data for the test project.
     */
    clearDatabase: (): Promise<void> => env.clearDatabase(),

    /**
     * Cleans up the test environment and all contexts.
     */
    cleanup: (): Promise<void> => env.cleanup(),

    /**
     * The raw @firebase/rules-unit-testing environment.
     */
    env,
  };
};

/**
 * Convenience object for creating rules tests.
 */
export const rulesTest = {
  /**
   * Creates a Firestore rules test helper.
   * @param options - Configuration options
   */
  firestore: createRulesTest,
};

export type { RulesTestContext, RulesTestEnvironment };
export { assertFails, assertSucceeds };
