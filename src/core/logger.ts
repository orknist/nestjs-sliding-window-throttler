/**
 * @fileoverview Simple logger interface for nestjs-sliding-window-throttler
 *
 * This module provides a flexible logger interface that can be implemented
 * by any logging library, with a default console implementation for development.
 */

// =============================================================================
// LOGGER INTERFACE
// =============================================================================

/**
 * Logger interface for sliding window throttler package
 *
 * This interface is specifically designed for the nestjs-sliding-window-throttler
 * package to avoid naming conflicts with other logging libraries.
 */
export interface SlidingWindowThrottlerLogger {
  /**
   * Log debug message with optional context
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Log info message with optional context
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log warning message with optional context
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log error message with optional error object and context
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

// =============================================================================
// DEFAULT CONSOLE LOGGER
// =============================================================================

/**
 * Simple console logger implementation for development use
 */
export class SlidingWindowThrottlerConsoleLogger implements SlidingWindowThrottlerLogger {
  constructor(private readonly enableDebug: boolean = false) {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.enableDebug) {
      console.debug(`[DEBUG] ${message}`, context ? this.safeStringify(context) : '');
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, context ? this.safeStringify(context) : '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ? this.safeStringify(context) : '');
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, error?.message || '', context ? this.safeStringify(context) : '');
    if (error?.stack) {
      console.error(error.stack);
    }
  }

  /**
   * Safely stringify context objects, handling circular references
   */
  private safeStringify(context: Record<string, unknown>): string {
    try {
      return JSON.stringify(context);
    } catch (error) {
      return '[Circular Reference]';
    }
  }
}

// =============================================================================
// LOGGER FACTORY
// =============================================================================

/**
 * Logger factory interface for creating named loggers
 */
export interface SlidingWindowThrottlerLoggerFactory {
  createLogger(name: string): SlidingWindowThrottlerLogger;
}

/**
 * Simple console logger factory
 */
export class SlidingWindowThrottlerConsoleLoggerFactory implements SlidingWindowThrottlerLoggerFactory {
  constructor(private readonly enableDebug: boolean = false) {}

  createLogger(name: string): SlidingWindowThrottlerLogger {
    return new SlidingWindowThrottlerConsoleLogger(this.enableDebug);
  }
}
