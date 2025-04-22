/**
 * Basic logger for internal modules.
 * Centralizes logging for the application.
 */

// Default log level in non-test environments
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'test' ? 'none' : 'info';

// Log levels in order of verbosity
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

// Mapping of log levels to numeric priorities
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

// Get the configured log level from environment or use default
const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || DEFAULT_LOG_LEVEL;
const CURRENT_LEVEL = LOG_LEVELS[configuredLevel] || LOG_LEVELS.info;

// Standalone logger instance for internal modules
export const logger = {
  /**
   * Log debug messages
   */
  debug: (message: string, ...args: any[]): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
      console.debug(`[debug] ${message}`, ...args);
    }
  },
  
  /**
   * Log informational messages
   */
  info: (message: string, ...args: any[]): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
      console.log(`[info] ${message}`, ...args);
    }
  },
  
  /**
   * Log warning messages
   */
  warn: (message: string, ...args: any[]): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
      console.warn(`[warn] ${message}`, ...args);
    }
  },
  
  /**
   * Log error messages
   */
  error: (message: string, ...args: any[]): void => {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
      console.error(`[error] ${message}`, ...args);
    }
  }
};

/**
 * Creates a custom logger with the specified prefix and minimum level
 */
export function createCustomLogger(
  prefix: string = '',
  minLevel: LogLevel = 'info'
) {
  const minLevelValue = LOG_LEVELS[minLevel] || LOG_LEVELS.info;
  
  return {
    debug: (message: string, ...args: any[]): void => {
      if (minLevelValue <= LOG_LEVELS.debug && CURRENT_LEVEL <= LOG_LEVELS.debug) {
        console.debug(`${prefix}[debug] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]): void => {
      if (minLevelValue <= LOG_LEVELS.info && CURRENT_LEVEL <= LOG_LEVELS.info) {
        console.log(`${prefix}[info] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: any[]): void => {
      if (minLevelValue <= LOG_LEVELS.warn && CURRENT_LEVEL <= LOG_LEVELS.warn) {
        console.warn(`${prefix}[warn] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: any[]): void => {
      if (minLevelValue <= LOG_LEVELS.error && CURRENT_LEVEL <= LOG_LEVELS.error) {
        console.error(`${prefix}[error] ${message}`, ...args);
      }
    }
  };
}