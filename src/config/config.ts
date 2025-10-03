import { ThrottlerConfigurationError } from '../core/errors';
import { RedisFailureStrategy } from './enums';
import { ThrottlerConfig } from './interfaces';
import { validateFailureStrategy, validatePort, validateRedisDb, validateMaxWindowSize, parseBoolean } from './validation';
export function createConfig(env: Record<string, string | undefined> = process.env): ThrottlerConfig {
  try {
    // Validate required environment variables
    const redisHost = env.REDIS_HOST;
    if (!redisHost) {
      throw new ThrottlerConfigurationError('REDIS_HOST is required');
    }

    const redisPortStr = env.REDIS_PORT;
    if (!redisPortStr) {
      throw new ThrottlerConfigurationError('REDIS_PORT is required');
    }

    // Parse and validate using validation utilities
    const redisPort = validatePort(redisPortStr);
    const redisDb = env.REDIS_DB ? validateRedisDb(env.REDIS_DB) : 0;

    // Parse failure strategy using enum-based validation
    const failureStrategyStr = env.FAILURE_STRATEGY || RedisFailureStrategy.FAIL_OPEN;
    const failureStrategy = validateFailureStrategy(failureStrategyStr);

    // Parse optional boolean values
    const enableDebugLogging = parseBoolean(env.ENABLE_DEBUG_LOGGING, process.env.NODE_ENV === 'development');
    const enableRedisFunctions = parseBoolean(env.ENABLE_REDIS_FUNCTIONS, true);

    // Parse optional numeric values
    const maxWindowSize = env.MAX_WINDOW_SIZE ? validateMaxWindowSize(env.MAX_WINDOW_SIZE) : 1000;

    return {
      redis: {
        host: redisHost,
        port: redisPort,
        db: redisDb,
        password: env.REDIS_PASSWORD || '',
        keyPrefix: env.REDIS_KEY_PREFIX || '',
      },
      throttler: {
        failureStrategy,
        keyPrefix: env.THROTTLER_KEY_PREFIX || 'throttle',
        enableDebugLogging,
        maxWindowSize,
        enableRedisFunctions,
      },
    };
  } catch (error) {
    if (error instanceof ThrottlerConfigurationError) {
      throw error;
    }
    // Wrap validation errors in configuration error
    throw new ThrottlerConfigurationError(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get configuration summary for logging
 *
 * @param config - Configuration to summarize
 * @returns Human-readable configuration summary
 */
export function getConfigSummary(config: ThrottlerConfig): string {
  return [
    '=== Throttler Configuration ===',
    `Redis: ${config.redis.host}:${config.redis.port} (db: ${config.redis.db ?? 0})`,
    `Key Prefix: ${config.redis.keyPrefix ?? 'throttle'}`,
    `Failure Strategy: ${config.throttler.failureStrategy}`,
    `Max Window Size: ${config.throttler.maxWindowSize ?? 1000}`,
    `Debug Logging: ${config.throttler.enableDebugLogging ? 'enabled' : 'disabled'}`,
    `Redis Functions: ${config.throttler.enableRedisFunctions !== false ? 'enabled' : 'disabled'}`,
    '==============================',
  ].join('\n');
}
