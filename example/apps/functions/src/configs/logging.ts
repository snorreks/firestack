import { getLogContext, setLogContext } from '@snorreks/firestack';
import { getFirestore } from './database.ts';

/**
 * A single log entry produced by the runtime logger.
 */
type LogEntry = {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data: unknown[];
  context: ReturnType<typeof getLogContext>;
  error?: { message: string; stack?: string; name: string };
};

const pendingEntries: LogEntry[] = [];

/**
 * Persists buffered log entries to Firestore.
 */
const flushToFirestore = async (): Promise<void> => {
  if (pendingEntries.length === 0) {
    return;
  }

  const entriesToFlush = pendingEntries.splice(0, pendingEntries.length);
  const firestore = getFirestore();
  const collection = firestore.collection('function_logs');

  await Promise.all(
    entriesToFlush.map((entry) =>
      collection.add({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        data: entry.data,
        context: entry.context,
        error: entry.error,
      })
    )
  );
};

/**
 * Creates a log entry, buffers it, and mirrors to the console.
 */
const log = (level: LogEntry['level'], message: string, data: unknown[], error?: Error): void => {
  const context = getLogContext() ?? { source: 'functions' };

  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data,
    context,
    error: error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : undefined,
  };

  pendingEntries.push(entry);

  const consoleMethod = console[level] ?? console.log;
  if (error) {
    consoleMethod(message, ...data, error);
  } else {
    consoleMethod(message, ...data);
  }
};

/**
 * Userland runtime logger for Firebase Functions.
 *
 * This is an example implementation that enriches every log with the
 * Firestack invocation context and persists entries to Firestore.
 *
 * Import it from `$logger` in your handlers and call
 * `flush()` at the end of each invocation (or use a wrapper).
 */
export const logger = {
  debug: (message: string, ...data: unknown[]): void => {
    log('debug', message, data);
  },

  info: (message: string, ...data: unknown[]): void => {
    log('info', message, data);
  },

  warn: (message: string, ...data: unknown[]): void => {
    log('warn', message, data);
  },

  error: (message: string, ...data: unknown[]): void => {
    const error = data.find((d) => d instanceof Error) as Error | undefined;
    log('error', message, data, error);
  },

  /**
   * Flushes all buffered entries to Firestore.
   * Call this in a `finally` block if you are not using Firestack wrappers.
   */
  flush: flushToFirestore,
};

/**
 * Re-exports from firestack so consumers can enrich context without
 * importing from two places.
 */
export { getLogContext, setLogContext };

// Container-level cleanup: flush any remaining entries when the container
// is about to shut down. This is a safety net; per-invocation flushing
// should happen inside your handler wrappers.
process.on('SIGTERM', async () => {
  await flushToFirestore();
});
