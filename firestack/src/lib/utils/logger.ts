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

export interface LogEntry {
  severity?: LogSeverity;
  logType?: LogType;
  message?: string;
}

export interface LoggerInterface {
  readonly currentLogSeverity: LogSeverity;

  setLogSeverity(options: { silent?: boolean; verbose?: boolean }): void;

  write(entry: LogEntry, ...data: unknown[]): void;
  debug(...args: unknown[]): void;
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

class LoggerService implements LoggerInterface {
  currentLogSeverity: LogSeverity = 'info';

  setLogSeverity(options: { silent?: boolean; verbose?: boolean }): void {
    if (options.silent) {
      this.currentLogSeverity = 'silent';
      return;
    }

    if (options.verbose) {
      this.currentLogSeverity = 'debug';
      return;
    }
  }

  write(entry: LogEntry, ...data: unknown[]): void {
    if (!this.currentLogSeverity) {
      return;
    }
    const { logType, message, severity } = entry;

    const currentLogSeverityPriority = this.toLogSeverityPriority(this.currentLogSeverity);
    const entryLogSeverityPriority = this.toLogSeverityPriority(severity || 'info');

    if (currentLogSeverityPriority > entryLogSeverityPriority) {
      return;
    }

    const log = console[logType || 'log'];
    if (typeof message !== 'undefined') {
      log(message, ...data);
    } else {
      log(...data);
    }
  }

  debug(...args: unknown[]): void {
    this.write(
      {
        logType: 'debug',
        severity: 'debug',
      },
      ...args
    );
  }
  info(...args: unknown[]): void {
    this.write(
      {
        logType: 'info',
        severity: 'info',
      },
      ...args
    );
  }
  warn(...args: unknown[]): void {
    this.write(
      {
        logType: 'warn',
        severity: 'warn',
      },
      chalk.yellow(args.join(' '))
    );
  }
  error(...args: unknown[]): void {
    this.write(
      {
        logType: 'error',
        severity: 'error',
      },
      chalk.red(args.join(' '))
    );
  }

  log(...args: unknown[]): void {
    this.write(
      {
        logType: 'log',
        severity: 'info',
      },
      ...args
    );
  }

  private toLogSeverityPriority(severity: LogSeverity): LogSeverityPriority {
    return LogSeverityPriority[severity];
  }
}

class LoggerFactory {
  private static logger: LoggerInterface = new LoggerService();
  static getLogger(): LoggerInterface {
    return LoggerFactory.logger;
  }
}

export const logger = LoggerFactory.getLogger();
