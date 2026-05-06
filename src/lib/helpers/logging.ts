import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Severity levels for log entries.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context automatically attached to every log entry written within an
 * invocation. Populated via AsyncLocalStorage by Firestack wrappers.
 */
export type LogContext = {
  source: 'client' | 'ssr' | 'functions';
  trigger?: string;
  functionName?: string;
  userId?: string;
  companyId?: string;
  sessionId?: string;
  ip?: string;
  route?: string;
  userAgent?: string;
  requestId?: string;
  [key: string]: unknown;
};

/**
 * AsyncLocalStorage instance that holds per-invocation log context.
 * End users should not need to access this directly.
 */
export const logContextStore = new AsyncLocalStorage<LogContext>();

/**
 * Returns the log context for the current invocation, or undefined if called
 * outside of a Firestack wrapper.
 * @returns The current log context.
 */
export const getLogContext = (): LogContext | undefined => {
  return logContextStore.getStore();
};

/**
 * Merges additional values into the log context for the current invocation.
 * Useful for adding userId or companyId after auth validation.
 * @param context - Partial context to merge.
 */
export const setLogContext = (context: Partial<LogContext>): void => {
  const store = logContextStore.getStore();
  if (store) {
    Object.assign(store, context);
  }
};

/**
 * Runs a function inside a new log context. Used internally by Firestack
 * wrappers. End users should not need to call this directly.
 * @param context - Initial log context for the invocation.
 * @param functionToRun - The function to execute within the context.
 * @returns The result of the function.
 */
export const runWithLogContext = <T>(
  context: LogContext,
  functionToRun: () => T | Promise<T>
): Promise<T> => {
  return logContextStore.run(context, async () => functionToRun());
};

/**
 * Wraps a handler function so it executes inside a log context. Used
 * internally by Firestack trigger wrappers.
 * @param handler - The handler to wrap.
 * @param buildContext - Function that builds the log context from the handler arguments.
 * @returns A wrapped handler with the same signature.
 */
export const wrapWithLogContext = <TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn,
  buildContext: (...args: TArgs) => LogContext
): ((...args: TArgs) => Promise<TReturn>) => {
  return (...args: TArgs) => {
    const context = buildContext(...args);
    return runWithLogContext(context, () => handler(...args));
  };
};
