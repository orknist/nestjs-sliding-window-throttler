import { RedisFailureStrategy } from './enums';
import { ThrottlerConfig } from './interfaces';

export function isRedisFailureStrategy(value: unknown): value is RedisFailureStrategy {
  return Object.values(RedisFailureStrategy).includes(value as RedisFailureStrategy);
}

export function validateFailureStrategy(value: unknown): RedisFailureStrategy {
  if (isRedisFailureStrategy(value)) {
    return value;
  }

  const validStrategies = Object.values(RedisFailureStrategy).join('", "');
  throw new Error(`Invalid failure strategy. Must be one of: "${validStrategies}"`);
}
export function validatePort(value: string | number): number {
  const port = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Port must be a valid port number (1-65535)');
  }

  return port;
}

/**
 * Validate Redis database number
 *
 * @param value - Database number to validate
 * @returns Validated database number
 * @throws Error if database number is invalid
 */
export function validateRedisDb(value: string | number): number {
  const db = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(db) || db < 0 || db > 15) {
    throw new Error('Redis database must be a number between 0 and 15');
  }

  return db;
}

/**
 * Validate maximum window size
 *
 * @param value - Window size to validate
 * @returns Validated window size
 * @throws Error if window size is invalid
 */
export function validateMaxWindowSize(value: string | number): number {
  const size = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(size) || size < 100 || size > 10000) {
    throw new Error('Maximum window size must be a number between 100 and 10000');
  }

  return size;
}

/**
 * Parse boolean value from string with proper defaults
 *
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed boolean value
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate configuration for production readiness
 *
 * @param config - Configuration to validate
 * @returns Validation result with warnings
 */
export function validateConfig(config: ThrottlerConfig): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Security warnings
  if (!config.redis.password && config.redis.host !== 'localhost' && config.redis.host !== '127.0.0.1') {
    warnings.push('Redis password not set for remote connection - this may be insecure');
  }

  if (config.throttler.failureStrategy === RedisFailureStrategy.FAIL_OPEN) {
    warnings.push('Using fail-open strategy - requests will be allowed when Redis is unavailable');
  }

  // Performance warnings
  if (config.throttler.enableDebugLogging && process.env.NODE_ENV === 'production') {
    warnings.push('Debug logging is enabled in production - this may impact performance');
  }

  if (config.throttler.maxWindowSize && config.throttler.maxWindowSize > 5000) {
    warnings.push('Large window size may impact memory usage and performance');
  }

  return {
    isValid: true, // All warnings are non-blocking
    warnings,
  };
}
