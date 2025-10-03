/**
 * @fileoverview Test data constants and scenarios for nestjs-sliding-window-throttler
 *
 * This module provides consistent test data, scenarios, and constants used across
 * all test files. All data is type-safe and follows professional standards.
 */

import { ThrottlerConfig, RedisConfig } from '../../src/config';
import { RedisFailureStrategy } from '../../src/core/types';
import { ThrottlerErrorCode } from '../../src/core/errors';
import { RateLimitScenario, ConcurrencyScenario } from './test-utils';

/**
 * Common test constants
 */
export const TestConstants = {
  /** Default test timeouts in milliseconds */
  TIMEOUTS: {
    UNIT: 5000,
    INTEGRATION: 30000,
    E2E: 20000
  },

  /** Default rate limiting values */
  RATE_LIMITS: {
    DEFAULT_LIMIT: 5,
    DEFAULT_TTL: 60000, // 1 minute
    DEFAULT_BLOCK_DURATION: 30000, // 30 seconds
    HIGH_LIMIT: 100,
    LOW_LIMIT: 2
  },

  /** Test key prefixes */
  KEY_PREFIXES: {
    UNIT: 'unit_test',
    INTEGRATION: 'integration_test',
    E2E: 'e2e_test',
    PERFORMANCE: 'perf_test'
  },

  /** Common throttler names */
  THROTTLER_NAMES: {
    DEFAULT: 'default',
    API: 'api',
    LOGIN: 'login',
    UPLOAD: 'upload',
    DOWNLOAD: 'download'
  },

  /** Test user identifiers */
  TEST_USERS: {
    ALICE: 'user_alice',
    BOB: 'user_bob',
    CHARLIE: 'user_charlie',
    ADMIN: 'admin_user',
    GUEST: 'guest_user'
  },

  /** Redis configuration values */
  REDIS: {
    DEFAULT_HOST: 'localhost',
    DEFAULT_PORT: 6379,
    TEST_DB: 0,
    INTEGRATION_DB: 1,
    E2E_DB: 2
  }
} as const;

/**
 * Pre-defined Redis configurations for different test scenarios
 */
export class TestConfigs {
  /**
   * Minimal Redis configuration for unit tests
   */
  static readonly MINIMAL_REDIS: RedisConfig = {
    host: TestConstants.REDIS.DEFAULT_HOST,
    port: TestConstants.REDIS.DEFAULT_PORT,
    db: TestConstants.REDIS.TEST_DB,
    keyPrefix: TestConstants.KEY_PREFIXES.UNIT
  };

  /**
   * Integration test Redis configuration
   */
  static readonly INTEGRATION_REDIS: RedisConfig = {
    host: process.env.REDIS_HOST || TestConstants.REDIS.DEFAULT_HOST,
    port: parseInt(process.env.REDIS_PORT || String(TestConstants.REDIS.DEFAULT_PORT), 10),
    db: TestConstants.REDIS.INTEGRATION_DB,
    keyPrefix: TestConstants.KEY_PREFIXES.INTEGRATION
  };

  /**
   * E2E test Redis configuration
   */
  static readonly E2E_REDIS: RedisConfig = {
    host: process.env.REDIS_HOST || TestConstants.REDIS.DEFAULT_HOST,
    port: parseInt(process.env.REDIS_PORT || String(TestConstants.REDIS.DEFAULT_PORT), 10),
    db: TestConstants.REDIS.E2E_DB,
    keyPrefix: TestConstants.KEY_PREFIXES.E2E
  };

  /**
   * Fail-open throttler configuration
   */
  static readonly FAIL_OPEN_CONFIG: ThrottlerConfig = {
    redis: TestConfigs.MINIMAL_REDIS,
    throttler: {
      failureStrategy: RedisFailureStrategy.FAIL_OPEN,
      enableDebugLogging: false,
      maxWindowSize: 1000,
      enableRedisFunctions: true
    }
  };

  /**
   * Fail-closed throttler configuration
   */
  static readonly FAIL_CLOSED_CONFIG: ThrottlerConfig = {
    redis: TestConfigs.MINIMAL_REDIS,
    throttler: {
      failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
      enableDebugLogging: false,
      maxWindowSize: 1000,
      enableRedisFunctions: true
    }
  };

  /**
   * Debug-enabled configuration for detailed testing
   */
  static readonly DEBUG_CONFIG: ThrottlerConfig = {
    redis: TestConfigs.MINIMAL_REDIS,
    throttler: {
      failureStrategy: RedisFailureStrategy.FAIL_OPEN,
      enableDebugLogging: true,
      maxWindowSize: 500,
      enableRedisFunctions: true
    }
  };

  /**
   * Lua-only configuration (Redis Functions disabled)
   */
  static readonly LUA_ONLY_CONFIG: ThrottlerConfig = {
    redis: TestConfigs.MINIMAL_REDIS,
    throttler: {
      failureStrategy: RedisFailureStrategy.FAIL_OPEN,
      enableDebugLogging: false,
      maxWindowSize: 1000,
      enableRedisFunctions: false
    }
  };
}

/**
 * Pre-defined rate limiting scenarios for testing
 */
export class TestScenarios {
  /**
   * Basic rate limiting scenario - requests within limit
   */
  static readonly WITHIN_LIMIT: RateLimitScenario = {
    key: TestConstants.TEST_USERS.ALICE,
    throttlerName: TestConstants.THROTTLER_NAMES.API,
    limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
    ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
    requestCount: 3, // Less than limit of 5
    blockDuration: TestConstants.RATE_LIMITS.DEFAULT_BLOCK_DURATION
  };

  /**
   * Rate limiting scenario - requests exceeding limit
   */
  static readonly EXCEEDS_LIMIT: RateLimitScenario = {
    key: TestConstants.TEST_USERS.BOB,
    throttlerName: TestConstants.THROTTLER_NAMES.API,
    limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
    ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
    requestCount: 8, // Exceeds limit of 5
    blockDuration: TestConstants.RATE_LIMITS.DEFAULT_BLOCK_DURATION
  };

  /**
   * High-frequency scenario with low limit
   */
  static readonly HIGH_FREQUENCY: RateLimitScenario = {
    key: TestConstants.TEST_USERS.CHARLIE,
    throttlerName: TestConstants.THROTTLER_NAMES.LOGIN,
    limit: TestConstants.RATE_LIMITS.LOW_LIMIT,
    ttl: 10000, // 10 seconds
    requestCount: 10,
    blockDuration: 5000 // 5 seconds
  };

  /**
   * Long-term scenario with high limit
   */
  static readonly LONG_TERM: RateLimitScenario = {
    key: TestConstants.TEST_USERS.ADMIN,
    throttlerName: TestConstants.THROTTLER_NAMES.UPLOAD,
    limit: TestConstants.RATE_LIMITS.HIGH_LIMIT,
    ttl: 300000, // 5 minutes
    requestCount: 50,
    blockDuration: 60000 // 1 minute
  };

  /**
   * No blocking scenario (blockDuration = 0)
   */
  static readonly NO_BLOCKING: RateLimitScenario = {
    key: TestConstants.TEST_USERS.GUEST,
    throttlerName: TestConstants.THROTTLER_NAMES.DOWNLOAD,
    limit: 3,
    ttl: 30000, // 30 seconds
    requestCount: 5,
    blockDuration: 0 // No blocking
  };
}

/**
 * Concurrency test scenarios
 */
export class ConcurrencyScenarios {
  /**
   * Light concurrency test
   */
  static readonly LIGHT_CONCURRENCY: ConcurrencyScenario = {
    userCount: 3,
    requestsPerUser: 2,
    limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
    ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
    blockDuration: TestConstants.RATE_LIMITS.DEFAULT_BLOCK_DURATION
  };

  /**
   * Heavy concurrency test
   */
  static readonly HEAVY_CONCURRENCY: ConcurrencyScenario = {
    userCount: 10,
    requestsPerUser: 5,
    limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
    ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
    blockDuration: TestConstants.RATE_LIMITS.DEFAULT_BLOCK_DURATION
  };

  /**
   * Stress test scenario
   */
  static readonly STRESS_TEST: ConcurrencyScenario = {
    userCount: 20,
    requestsPerUser: 10,
    limit: TestConstants.RATE_LIMITS.HIGH_LIMIT,
    ttl: 120000, // 2 minutes
    blockDuration: 30000 // 30 seconds
  };
}

/**
 * Error scenarios for testing error handling
 */
export class ErrorScenarios {
  /**
   * Invalid configuration scenarios
   */
  static readonly INVALID_CONFIGS = {
    EMPTY_KEY: {
      key: '',
      throttlerName: TestConstants.THROTTLER_NAMES.API,
      limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
      ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
      expectedError: ThrottlerErrorCode.INVALID_CONFIGURATION
    },
    
    NEGATIVE_LIMIT: {
      key: TestConstants.TEST_USERS.ALICE,
      throttlerName: TestConstants.THROTTLER_NAMES.API,
      limit: -1,
      ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
      expectedError: ThrottlerErrorCode.INVALID_CONFIGURATION
    },
    
    ZERO_TTL: {
      key: TestConstants.TEST_USERS.ALICE,
      throttlerName: TestConstants.THROTTLER_NAMES.API,
      limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
      ttl: 0,
      expectedError: ThrottlerErrorCode.INVALID_CONFIGURATION
    },
    
    EMPTY_THROTTLER_NAME: {
      key: TestConstants.TEST_USERS.ALICE,
      throttlerName: '',
      limit: TestConstants.RATE_LIMITS.DEFAULT_LIMIT,
      ttl: TestConstants.RATE_LIMITS.DEFAULT_TTL,
      expectedError: ThrottlerErrorCode.INVALID_CONFIGURATION
    }
  };

  /**
   * Redis connection error messages
   */
  static readonly REDIS_ERRORS = {
    CONNECTION_REFUSED: 'connect ECONNREFUSED 127.0.0.1:6379',
    TIMEOUT: 'Connection timeout',
    NETWORK_ERROR: 'Network error',
    AUTH_FAILED: 'Authentication failed'
  };
}

/**
 * Performance test data
 */
export class PerformanceData {
  /**
   * Performance benchmarks in milliseconds
   */
  static readonly BENCHMARKS = {
    UNIT_TEST_MAX: 100, // Each unit test should complete in under 100ms
    INTEGRATION_OPERATION_MAX: 1000, // Each integration operation under 1s
    E2E_REQUEST_MAX: 2000, // Each E2E request under 2s
    BATCH_OPERATION_MAX: 5000 // Batch operations under 5s
  };

  /**
   * Load test parameters
   */
  static readonly LOAD_TEST = {
    CONCURRENT_USERS: 50,
    REQUESTS_PER_USER: 20,
    RAMP_UP_TIME: 10000, // 10 seconds
    TEST_DURATION: 60000 // 1 minute
  };
}

/**
 * Test data generators for dynamic test scenarios
 */
export class TestDataGenerators {
  /**
   * Generate a unique test key
   * 
   * @param prefix - Key prefix
   * @returns Unique test key
   */
  static generateTestKey(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Generate multiple unique test keys
   * 
   * @param count - Number of keys to generate
   * @param prefix - Key prefix
   * @returns Array of unique test keys
   */
  static generateTestKeys(count: number, prefix: string = 'test'): string[] {
    return Array.from({ length: count }, () => TestDataGenerators.generateTestKey(prefix));
  }

  /**
   * Generate a rate limit scenario with random parameters
   * 
   * @param baseScenario - Base scenario to modify
   * @param variations - Parameter variations
   * @returns Modified rate limit scenario
   */
  static generateVariedScenario(
    baseScenario: RateLimitScenario,
    variations: Partial<RateLimitScenario> = {}
  ): RateLimitScenario {
    return {
      ...baseScenario,
      key: TestDataGenerators.generateTestKey(),
      ...variations
    };
  }

  /**
   * Generate test scenarios for boundary testing
   * 
   * @returns Array of boundary test scenarios
   */
  static generateBoundaryScenarios(): RateLimitScenario[] {
    return [
      // Exactly at limit
      {
        key: TestDataGenerators.generateTestKey('boundary'),
        throttlerName: TestConstants.THROTTLER_NAMES.API,
        limit: 5,
        ttl: 60000,
        requestCount: 5,
        blockDuration: 30000
      },
      // One over limit
      {
        key: TestDataGenerators.generateTestKey('boundary'),
        throttlerName: TestConstants.THROTTLER_NAMES.API,
        limit: 5,
        ttl: 60000,
        requestCount: 6,
        blockDuration: 30000
      },
      // Minimum values
      {
        key: TestDataGenerators.generateTestKey('boundary'),
        throttlerName: TestConstants.THROTTLER_NAMES.API,
        limit: 1,
        ttl: 1000,
        requestCount: 2,
        blockDuration: 1000
      }
    ];
  }
}