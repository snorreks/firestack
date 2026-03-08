import chalk from 'chalk';

export type LogType = 'debug' | 'info' | 'warn' | 'error' | 'log';

enum LogSeverityPriority {
  silent = 0,
  debug = 1,
  info = 2,
  warn = 4,
  error = 5,
}

export type LogSeverity = keyof typeof LogSeverityPriority;

export type LogEntry = {
  severity?: LogSeverity;
  logType?: LogType;
  message?: string;
};

type SetLogSeverityOptions = {
  silent?: boolean;
  verbose?: boolean;
};

/**
 * Interface for the logger service.
 */
export type LoggerInterface = {
  /**
   * The current log severity.
   */
  readonly currentLogSeverity: LogSeverity;

  /**
   * Sets the log severity based on the provided options.
   * @param options - Options containing silent and verbose flags.
   */
  setLogSeverity(options: SetLogSeverityOptions): void;

  /**
   * Writes a log entry to the console.
   * @param entry - The log entry to write.
   * @param data - Additional data to log.
   */
  write(entry: LogEntry, ...data: unknown[]): void;

  /**
   * Logs a debug message.
   * @param args - The message or data to log.
   */
  debug(...args: unknown[]): void;

  /**
   * Logs an info message.
   * @param args - The message or data to log.
   */
  log(...args: unknown[]): void;

  /**
   * Logs an info message.
   * @param args - The message or data to log.
   */
  info(...args: unknown[]): void;

  /**
   * Logs a warning message.
   * @param args - The message or data to log.
   */
  warn(...args: unknown[]): void;

  /**
   * Logs an error message.
   * @param args - The message or data to log.
   */
  error(...args: unknown[]): void;
};

const toLogSeverityPriority = (severity: LogSeverity): LogSeverityPriority => {
  return LogSeverityPriority[severity];
};

const createLoggerService = (): LoggerInterface => {
  let currentLogSeverity: LogSeverity = 'info';

  const setLogSeverity = (options: SetLogSeverityOptions): void => {
    if (options.silent) {
      currentLogSeverity = 'silent';
      return;
    }

    if (options.verbose) {
      currentLogSeverity = 'debug';
      return;
    }
  };

  const write = (entry: LogEntry, ...data: unknown[]): void => {
    if (!currentLogSeverity) {
      return;
    }
    const { logType, message, severity } = entry;

    const currentPriority = toLogSeverityPriority(currentLogSeverity);
    const entryPriority = toLogSeverityPriority(severity || 'info');

    if (currentPriority > entryPriority) {
      return;
    }

    const log = console[logType || 'log'];
    if (typeof message !== 'undefined') {
      log(message, ...data);
    } else {
      log(...data);
    }
  };

  const debug = (...args: unknown[]): void => {
    write({ logType: 'debug', severity: 'debug' }, ...args);
  };

  const info = (...args: unknown[]): void => {
    write({ logType: 'info', severity: 'info' }, ...args);
  };

  const warn = (...args: unknown[]): void => {
    write({ logType: 'warn', severity: 'warn' }, chalk.yellow(args.join(' ')));
  };

  const error = (...args: unknown[]): void => {
    write({ logType: 'error', severity: 'error' }, chalk.red(args.join(' ')));
  };

  const log = (...args: unknown[]): void => {
    write({ logType: 'log', severity: 'info' }, ...args);
  };

  return {
    get currentLogSeverity() {
      return currentLogSeverity;
    },
    setLogSeverity: setLogSeverity,
    write,
    debug,
    log,
    info,
    warn,
    error,
  };
};

// biome ignore noStaticOnlyClass: Factory pattern is intentional for singleton
let loggerInstance: LoggerInterface | null = null;

const getLogger = (): LoggerInterface => {
  if (!loggerInstance) {
    loggerInstance = createLoggerService();
  }
  return loggerInstance;
};

export const logger: LoggerInterface = getLogger();
