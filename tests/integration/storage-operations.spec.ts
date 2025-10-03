/**
 * @fileoverview Integration tests for storage operations with real Redis
 *
 * These tests verify storage functionality including rate limiting scenarios,
 * reset functionality, and concurrent operations using real Redis instances.
 */

import { Redis } from 'ioredis';
import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { RedisFunctionsManager } from '../../src/redis/redis-functions.manager';
import { KeyGenerator } from '../../src/core/key-generator';
import { SlidingWindowThrottlerConsoleLogger } from '../../src/core/logger';
import { TestUtils, RateLimitScenario } from '../shared/test-utils';
import { TestConstants, TestConfigs, TestScenarios } from '../shared/test-data';
import { RedisFailureStrategy } from '../../src/core/types';
import { ThrottlerConfig } from '../../src/config';

describe('Storage Operations Integration', () => {
  let redis: Redis;
  let storage: SlidingWindowThrottlerStorage;
  let functionsManager: RedisFunctionsManager;
  let keyGenerator: KeyGenerator;
  let logger: SlidingWindowThrottlerConsoleLogger;
  let config: ThrottlerConfig;

  beforeAll(async () => {
    // Create Redis client for integration testing
    redis = new Redis({
      host: TestConfigs.INTEGRATION_REDIS.host,
      port: TestConfigs.INTEGRATION_REDIS.port,
      db: TestConfigs.INTEGRATION_REDIS.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Create logger for testing
    logger = new SlidingWindowThrottlerConsoleLogger(false);

    // Wait for Redis connection
    await redis.connect();
    
    // Clean any existing test data
    await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
  });

  afterAll(async () => {
    if (redis) {
      await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clean test data before each test
    await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
    
    // Clean any existing Redis Functions
    try {
      await redis.function('FLUSH');
    } catch (error) {
      // Ignore if Redis Functions not supported
    }

    // Create test configuration
    config = {
      redis: TestConfigs.INTEGRATION_REDIS,
      throttler: {
        failureStrategy: RedisFailureStrategy.FAIL_OPEN,
        enableDebugLogging: false,
        maxWindowSize: 1000,
        enableRedisFunctions: true
      }
    };

    // Create components
    keyGenerator = new KeyGenerator({ prefix: TestConfigs.INTEGRATION_REDIS.keyPrefix });
    functionsManager = new RedisFunctionsManager(redis, {
      libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
      logger
    });

    // Initialize Redis Functions
    await functionsManager.initialize();

    // Create storage instance
    storage = new SlidingWindowThrottlerStorage(
      redis,
      config,
      functionsManager,
      keyGenerator,
      logger
    );
  });

  describe('Basic Storage Operations', () => {
    it('should handle increment operations correctly', async () => {
      // Arrange
      const key = TestUtils.getTestKey('basic');
      const ttl = 60000;
      const limit = 5;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act
      const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);

      // Assert
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
      expect(result.timeToExpire).toBeGreaterThan(0);
      expect(result.timeToBlockExpire).toBe(-1);
    });

    it('should handle multiple increments within limit', async () => {
      // Arrange
      const key = TestUtils.getTestKey('multiple');
      const ttl = 60000;
      const limit = 5;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act - Make multiple requests within limit
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
        results.push(result);
      }

      // Assert
      expect(results[0].totalHits).toBe(1);
      expect(results[1].totalHits).toBe(2);
      expect(results[2].totalHits).toBe(3);
      
      results.forEach(result => {
        expect(result.isBlocked).toBe(false);
        expect(result.timeToExpire).toBeGreaterThan(0);
      });
    });

    it('should block requests when limit is exceeded', async () => {
      // Arrange
      const key = TestUtils.getTestKey('exceed');
      const ttl = 60000;
      const limit = 3;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act - Exceed the limit
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
        results.push(result);
      }

      // Assert
      expect(results[0].isBlocked).toBe(false); // 1st request
      expect(results[1].isBlocked).toBe(false); // 2nd request
      expect(results[2].isBlocked).toBe(false); // 3rd request
      expect(results[3].isBlocked).toBe(true);  // 4th request (blocked)
      expect(results[4].isBlocked).toBe(true);  // 5th request (blocked)
      
      // Blocked requests should have block expiry time
      expect(results[3].timeToBlockExpire).toBeGreaterThan(0);
      expect(results[4].timeToBlockExpire).toBeGreaterThan(0);
    });

    it('should handle zero block duration correctly', async () => {
      // Arrange
      const key = TestUtils.getTestKey('no_block');
      const ttl = 60000;
      const limit = 2;
      const blockDuration = 0; // No blocking
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act - Exceed the limit
      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
        results.push(result);
      }

      // Assert
      expect(results[0].isBlocked).toBe(false); // 1st request
      expect(results[1].isBlocked).toBe(false); // 2nd request
      expect(results[2].isBlocked).toBe(true);  // 3rd request (over limit but no blocking)
      expect(results[3].isBlocked).toBe(true);  // 4th request (over limit but no blocking)
      
      // No block expiry time when blockDuration is 0
      expect(results[2].timeToBlockExpire).toBe(-1);
      expect(results[3].timeToBlockExpire).toBe(-1);
    });
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle TestUtils.createRateLimitScenario for within limit scenario', async () => {
      // Arrange
      const scenario: RateLimitScenario = {
        ...TestScenarios.WITHIN_LIMIT,
        key: TestUtils.getTestKey('within_limit')
      };

      // Act
      const result = await TestUtils.createRateLimitScenario(storage, scenario);

      // Assert
      expect(result.allowedCount).toBe(scenario.requestCount);
      expect(result.blockedCount).toBe(0);
      expect(result.finalRecord.isBlocked).toBe(false);
      expect(result.requestResults).toHaveLength(scenario.requestCount);
    });

    it('should handle TestUtils.createRateLimitScenario for exceeds limit scenario', async () => {
      // Arrange
      const scenario: RateLimitScenario = {
        ...TestScenarios.EXCEEDS_LIMIT,
        key: TestUtils.getTestKey('exceeds_limit')
      };

      // Act
      const result = await TestUtils.createRateLimitScenario(storage, scenario);

      // Assert
      expect(result.allowedCount).toBe(scenario.limit);
      expect(result.blockedCount).toBe(scenario.requestCount - scenario.limit);
      expect(result.finalRecord.isBlocked).toBe(true);
      expect(result.requestResults).toHaveLength(scenario.requestCount);
    });

    it('should handle high frequency scenario correctly', async () => {
      // Arrange
      const scenario: RateLimitScenario = {
        ...TestScenarios.HIGH_FREQUENCY,
        key: TestUtils.getTestKey('high_freq')
      };

      // Act
      const result = await TestUtils.createRateLimitScenario(storage, scenario);

      // Assert
      expect(result.allowedCount).toBe(scenario.limit);
      expect(result.blockedCount).toBe(scenario.requestCount - scenario.limit);
      expect(result.finalRecord.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('should handle no blocking scenario correctly', async () => {
      // Arrange
      const scenario: RateLimitScenario = {
        ...TestScenarios.NO_BLOCKING,
        key: TestUtils.getTestKey('no_blocking')
      };

      // Act
      const result = await TestUtils.createRateLimitScenario(storage, scenario);

      // Assert
      expect(result.allowedCount).toBe(scenario.limit);
      expect(result.blockedCount).toBe(scenario.requestCount - scenario.limit);
      expect(result.finalRecord.timeToBlockExpire).toBe(-1); // No blocking
    });
  });

  describe('Reset Functionality', () => {
    it('should reset rate limit data correctly', async () => {
      // Arrange
      const key = TestUtils.getTestKey('reset');
      const ttl = 60000;
      const limit = 3;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Make some requests to create data
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      
      // Verify data exists
      const beforeReset = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(beforeReset.totalHits).toBe(3);

      // Act - Reset the data
      await storage.reset(key);

      // Assert - Next request should start fresh
      const afterReset = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(afterReset.totalHits).toBe(1);
      expect(afterReset.isBlocked).toBe(false);
    });

    it('should handle reset for non-existent key gracefully', async () => {
      // Arrange
      const nonExistentKey = TestUtils.getTestKey('non_existent');

      // Act & Assert - Should not throw error
      await expect(storage.reset(nonExistentKey)).resolves.not.toThrow();
    });

    it('should reset blocked state correctly', async () => {
      // Arrange
      const key = TestUtils.getTestKey('reset_blocked');
      const ttl = 60000;
      const limit = 2;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Exceed limit to trigger blocking
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      const blocked = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(blocked.isBlocked).toBe(true);

      // Act - Reset
      await storage.reset(key);

      // Assert - Should not be blocked anymore
      const afterReset = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(afterReset.isBlocked).toBe(false);
      expect(afterReset.totalHits).toBe(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent increments correctly', async () => {
      // Arrange
      const key = TestUtils.getTestKey('concurrent');
      const ttl = 60000;
      const limit = 10;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;
      const concurrentRequests = 5;

      // Act - Make concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        storage.increment(key, ttl, limit, blockDuration, throttlerName)
      );
      
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(concurrentRequests);
      
      // All requests should be allowed (within limit)
      results.forEach(result => {
        expect(result.isBlocked).toBe(false);
        expect(result.totalHits).toBeGreaterThan(0);
        expect(result.totalHits).toBeLessThanOrEqual(concurrentRequests);
      });

      // Final count should be the number of concurrent requests
      const finalResult = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(finalResult.totalHits).toBe(concurrentRequests + 1);
    });

    it('should handle concurrent operations with limit exceeded', async () => {
      // Arrange
      const key = TestUtils.getTestKey('concurrent_limit');
      const ttl = 60000;
      const limit = 3;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;
      const concurrentRequests = 8;

      // Act - Make concurrent requests that exceed limit
      const promises = Array.from({ length: concurrentRequests }, () =>
        storage.increment(key, ttl, limit, blockDuration, throttlerName)
      );
      
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(concurrentRequests);
      
      const allowedResults = results.filter(r => !r.isBlocked);
      const blockedResults = results.filter(r => r.isBlocked);
      
      // Should have some allowed and some blocked
      expect(allowedResults.length).toBeGreaterThan(0);
      expect(blockedResults.length).toBeGreaterThan(0);
      expect(allowedResults.length + blockedResults.length).toBe(concurrentRequests);
    });

    it('should handle concurrent reset operations', async () => {
      // Arrange
      const key = TestUtils.getTestKey('concurrent_reset');
      const ttl = 60000;
      const limit = 5;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Create some data first
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);

      // Act - Concurrent resets (should be safe)
      const resetPromises = Array.from({ length: 3 }, () => storage.reset(key));
      await Promise.all(resetPromises);

      // Assert - Should be able to start fresh
      const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
    });
  });

  describe('Failure Strategy Testing', () => {
    it('should handle FAIL_OPEN strategy by testing configuration', async () => {
      // Arrange
      const failOpenConfig: ThrottlerConfig = {
        ...config,
        throttler: {
          ...config.throttler,
          failureStrategy: RedisFailureStrategy.FAIL_OPEN
        }
      };

      const failOpenStorage = new SlidingWindowThrottlerStorage(
        redis,
        failOpenConfig,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act - Normal operation should work
      const result = await failOpenStorage.increment(
        TestUtils.getTestKey('fail_open'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should work normally when Redis is available
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });

    it('should handle FAIL_CLOSED strategy by testing configuration', async () => {
      // Arrange
      const failClosedConfig: ThrottlerConfig = {
        ...config,
        throttler: {
          ...config.throttler,
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED
        }
      };

      const failClosedStorage = new SlidingWindowThrottlerStorage(
        redis,
        failClosedConfig,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act - Normal operation should work
      const result = await failClosedStorage.increment(
        TestUtils.getTestKey('fail_closed'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should work normally when Redis is available
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });

    it('should handle Redis disconnection gracefully', async () => {
      // Arrange
      const key = TestUtils.getTestKey('disconnect_test');
      const ttl = 60000;
      const limit = 5;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Make a successful request first
      const beforeDisconnect = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(beforeDisconnect.isBlocked).toBe(false);

      // Simulate temporary disconnection by closing and reconnecting
      await redis.disconnect();
      
      // Try to make a request while disconnected (should handle gracefully)
      let disconnectedResult;
      try {
        disconnectedResult = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }

      // Reconnect
      await redis.connect();
      
      // Should work again after reconnection
      const afterReconnect = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      expect(afterReconnect.totalHits).toBeGreaterThan(0);
    });
  });

  describe('Lua Script Fallback', () => {
    it('should work correctly when Redis Functions are disabled', async () => {
      // Arrange
      const luaOnlyConfig: ThrottlerConfig = {
        ...config,
        throttler: {
          ...config.throttler,
          enableRedisFunctions: false
        }
      };

      const luaOnlyStorage = new SlidingWindowThrottlerStorage(
        redis,
        luaOnlyConfig,
        functionsManager,
        keyGenerator,
        logger
      );

      const key = TestUtils.getTestKey('lua_fallback');
      const ttl = 60000;
      const limit = 3;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act - Make requests using Lua script fallback
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await luaOnlyStorage.increment(key, ttl, limit, blockDuration, throttlerName);
        results.push(result);
      }

      // Assert - Should work the same as Redis Functions
      expect(results[0].isBlocked).toBe(false);
      expect(results[1].isBlocked).toBe(false);
      expect(results[2].isBlocked).toBe(false);
      expect(results[3].isBlocked).toBe(true);
      expect(results[4].isBlocked).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    it('should complete operations within performance benchmarks', async () => {
      // Arrange
      const key = TestUtils.getTestKey('performance');
      const ttl = 60000;
      const limit = 100;
      const blockDuration = 30000;
      const throttlerName = TestConstants.THROTTLER_NAMES.API;

      // Act
      const startTime = Date.now();
      await storage.increment(key, ttl, limit, blockDuration, throttlerName);
      const duration = Date.now() - startTime;

      // Assert - Should complete within 1 second for integration tests
      expect(duration).toBeLessThan(1000);
    });

    it('should handle batch operations efficiently', async () => {
      // Arrange
      const batchSize = 20;
      const operations = Array.from({ length: batchSize }, (_, i) => ({
        key: TestUtils.getTestKey(`batch_${i}`),
        ttl: 60000,
        limit: 10,
        blockDuration: 30000,
        throttlerName: TestConstants.THROTTLER_NAMES.API
      }));

      // Act
      const startTime = Date.now();
      const promises = operations.map(op =>
        storage.increment(op.key, op.ttl, op.limit, op.blockDuration, op.throttlerName)
      );
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(batchSize);
      expect(duration).toBeLessThan(5000); // 5 seconds for batch operations
      
      results.forEach(result => {
        expect(result.totalHits).toBe(1);
        expect(result.isBlocked).toBe(false);
      });
    });
  });
});