import { env } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private prefix = '[InterviewOS]';

  private shouldLog(level: LogLevel): boolean {
    const configuredWeight = LOG_LEVEL_WEIGHTS[env.logLevel] ?? 0;
    const targetWeight = LOG_LEVEL_WEIGHTS[level];
    return targetWeight >= configuredWeight;
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.log(`%c${this.prefix} [DEBUG] ${message}`, 'color: #94a3b8;', ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.info(`%c${this.prefix} [INFO] ${message}`, 'color: #38bdf8;', ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(`%c${this.prefix} [WARN] ${message}`, 'color: #f59e0b;', ...args);
    }
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error')) {
      console.error(`%c${this.prefix} [ERROR] ${message}`, 'color: #ef4444;', ...args);
    }
  }
}

export const logger = new Logger();
