/**
 * Logger utility for LinkedIn node
 * Provides consistent logging with levels and formatting
 */

/**
 * Log levels 
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

let currentLogLevel: LogLevel = LogLevel.INFO;

/**
 * Sets the global log level
 * @param level LogLevel to set
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Format a log message with the prefix
 * @param message Log message
 * @param prefix Prefix to add
 */
function formatLogMessage(message: string, prefix: string): string {
  return `LinkedIn Node [${prefix}]: ${message}`;
}

/**
 * Log an error message
 * @param message Error message
 * @param error Optional error object
 */
export function error(message: string, error?: Error): void {
  if (currentLogLevel >= LogLevel.ERROR) {
    console.error(formatLogMessage(message, 'ERROR'), error || '');
  }
}

/**
 * Log a warning message
 * @param message Warning message
 */
export function warn(message: string): void {
  if (currentLogLevel >= LogLevel.WARN) {
    console.warn(formatLogMessage(message, 'WARN'));
  }
}

/**
 * Log an info message
 * @param message Info message
 */
export function info(message: string): void {
  if (currentLogLevel >= LogLevel.INFO) {
    console.log(formatLogMessage(message, 'INFO'));
  }
}

/**
 * Log a debug message
 * @param message Debug message
 */
export function debug(message: string): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(formatLogMessage(message, 'DEBUG'));
  }
}