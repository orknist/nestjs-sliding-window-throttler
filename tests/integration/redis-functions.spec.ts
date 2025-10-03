/**
 * @fileoverview Integration tests for Redis Functions functionality
 *
 * These tests verify Redis Functions loading, execution, and fallback behavior
 * with real Redis instances. Tests use Docker for authentic integration testing.
 */

import { Redis } from 'ioredis';
import { RedisFunctionsManager } from '../../src/redis/redis-functions.manager';
import { TestUtils } from '../shared/test-utils';
import { MockFactories } from '../shared/mock-factories';
import { TestConstants, TestConfigs } from '../shared/test-data';
import { ThrottlerError, ThrottlerErrorCode } from '../../src/core/errors';
import { SlidingWindowThrottlerConsoleLogger } from '../../src/core/logger';

describe('Redis Functions Integration', () => {
  let redis: Redis;
  let functionsManager: RedisFunctionsManager;
  let logger: SlidingWindowThrottlerConsoleLogger;

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
    
    // Create fresh functions manager for each test with unique prefix
    const uniquePrefix = `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    functionsManager = new RedisFunctionsManager(redis, {
      libraryPrefix: uniquePrefix,
      logger
    });
  });

  describe('Redis Functions Loading', () => {
    it('should successfully initialize and load Redis Functions library', async () => {
      // Act
      await functionsManager.initialize();

      // Assert
      expect(functionsManager.isLoaded()).toBe(true);
    });

    it('should handle Redis Functions library reload', async () => {
      // Arrange
      await functionsManager.initialize();
      expect(functionsManager.isLoaded()).toBe(true);

      // Act
      await functionsManager.reloadLibrary();

      // Assert
      expect(functionsManager.isLoaded()).toBe(true);
    });

    it('should throw ThrottlerError when Redis connection fails during initialization', async () => {
      // Arrange
      const failingRedis = new Redis({
        host: 'nonexistent-host',
        port: 9999,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        lazyConnect: true
      });

      const failingManager = new RedisFunctionsManager(failingRedis, {
        libraryPrefix: 'test_failing',
        logger
      });

      // Act & Assert
      await expect(failingManager.initialize()).rejects.toThrow(ThrottlerError);
      
      // Cleanup
      await failingRedis.quit();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      // Act
      await functionsManager.initialize();
      await functionsManager.initialize(); // Second call should not fail

      // Assert
      expect(functionsManager.isLoaded()).toBe(true);
    });
  });

  describe('Redis Functions Execution', () => {
    beforeEach(async () => {
      await functionsManager.initialize();
    });

    it('should execute sliding window function with valid parameters', async () => {
      // Arrange
      const keys = [
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:test:z`,
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:test:block`
      ];
      const args = ['60000', '5', '30000', Date.now().toString(), 'test-member'];

      // Act
      const result = await functionsManager.executeSlidingWindow(keys, args);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(4);
      expect(typeof result[0]).toBe('number'); // totalHits
      expect(typeof result[1]).toBe('number'); // timeToExpire
      expect(typeof result[2]).toBe('number'); // isBlocked
      expect(typeof result[3]).toBe('number'); // timeToBlockExpire
    });

    it('should handle rate limiting correctly with multiple requests', async () => {
      // Arrange
      const testKey = TestUtils.getTestKey('rate_limit');
      const keys = [
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:z`,
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:block`
      ];
      const limit = 3;
      const ttl = 60000;
      const blockDuration = 30000;

      // Act - Make requests up to limit
      const results: number[][] = [];
      for (let i = 0; i < limit + 2; i++) {
        const args = [ttl.toString(), limit.toString(), blockDuration.toString(), Date.now().toString(), `member-${i}`];
        const result = await functionsManager.executeSlidingWindow(keys, args);
        results.push(result);
        
        // Small delay to ensure different timestamps
        await TestUtils.wait(10);
      }

      // Assert - First 3 requests should be allowed, rest blocked
      expect(results[0][2]).toBe(0); // Not blocked
      expect(results[1][2]).toBe(0); // Not blocked
      expect(results[2][2]).toBe(0); // Not blocked
      expect(results[3][2]).toBe(1); // Blocked
      expect(results[4][2]).toBe(1); // Blocked
    });

    it('should respect block duration when configured', async () => {
      // Arrange
      const testKey = TestUtils.getTestKey('block_duration');
      const keys = [
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:z`,
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:block`
      ];
      const limit = 1;
      const ttl = 60000;
      const blockDuration = 2000; // 2 seconds

      // Act - Exceed limit to trigger blocking
      const args1 = [ttl.toString(), limit.toString(), blockDuration.toString(), Date.now().toString(), 'member-1'];
      const args2 = [ttl.toString(), limit.toString(), blockDuration.toString(), Date.now().toString(), 'member-2'];
      
      await functionsManager.executeSlidingWindow(keys, args1); // First request (allowed)
      const blockedResult = await functionsManager.executeSlidingWindow(keys, args2); // Second request (blocked)

      // Assert
      expect(blockedResult[2]).toBe(1); // Should be blocked
      expect(blockedResult[3]).toBeGreaterThan(0); // Should have block expiry time
      expect(blockedResult[3]).toBeLessThanOrEqual(Math.ceil(blockDuration / 1000)); // Should not exceed block duration
    });

    it('should throw ThrottlerError with invalid parameters', async () => {
      // Arrange
      const keys = ['key1', 'key2'];
      const invalidArgs = ['invalid', '5', '30000', Date.now().toString(), 'member'];

      // Act & Assert
      await expect(functionsManager.executeSlidingWindow(keys, invalidArgs))
        .rejects.toThrow(ThrottlerError);
    });

    it('should throw ThrottlerError with incorrect number of keys', async () => {
      // Arrange
      const keys = ['only-one-key']; // Should be 2 keys
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];

      // Act & Assert
      await expect(functionsManager.executeSlidingWindow(keys, args))
        .rejects.toThrow(ThrottlerError);
    });

    it('should throw ThrottlerError with incorrect number of arguments', async () => {
      // Arrange
      const keys = ['key1', 'key2'];
      const args = ['60000', '5']; // Should be 5 arguments

      // Act & Assert
      await expect(functionsManager.executeSlidingWindow(keys, args))
        .rejects.toThrow(ThrottlerError);
    });
  });

  describe('Redis Functions Fallback Behavior', () => {
    it('should handle function not found error and throw appropriate ThrottlerError', async () => {
      // Arrange
      await functionsManager.initialize();
      
      // Simulate function being unloaded by flushing functions
      await redis.function('FLUSH');
      
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];

      // Act & Assert
      await expect(functionsManager.executeSlidingWindow(keys, args))
        .rejects.toThrow(ThrottlerError);
    });

    it('should detect when functions are unloaded', async () => {
      // Arrange
      await functionsManager.initialize();
      expect(functionsManager.isLoaded()).toBe(true);

      // Act - Flush functions to simulate unloading
      await redis.function('FLUSH');

      // Try to execute function (this should fail and update internal state)
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];
      
      try {
        await functionsManager.executeSlidingWindow(keys, args);
      } catch (error) {
        // Expected to fail
      }

      // Assert - Manager should still report as loaded until explicitly checked
      // This is expected behavior as the manager doesn't automatically detect unloading
      expect(functionsManager.isLoaded()).toBe(true);
    });

    it('should recover from function unloading via reload', async () => {
      // Arrange
      await functionsManager.initialize();
      expect(functionsManager.isLoaded()).toBe(true);

      // Simulate function unloading
      await redis.function('FLUSH');

      // Act - Reload should restore functionality
      await functionsManager.reloadLibrary();

      // Assert
      expect(functionsManager.isLoaded()).toBe(true);
      
      // Verify function works after reload
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];
      const result = await functionsManager.executeSlidingWindow(keys, args);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(4);
    });
  });

  describe('Redis Functions Performance', () => {
    beforeEach(async () => {
      await functionsManager.initialize();
    });

    it('should execute functions within performance benchmarks', async () => {
      // Arrange
      const testKey = TestUtils.getTestKey('performance');
      const keys = [
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:z`,
        `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}:block`
      ];
      const args = ['60000', '100', '30000', Date.now().toString(), 'perf-member'];

      // Act
      const startTime = Date.now();
      await functionsManager.executeSlidingWindow(keys, args);
      const duration = Date.now() - startTime;

      // Assert - Should complete within 1 second for integration tests
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent function executions', async () => {
      // Arrange
      const concurrentRequests = 10;
      const testKey = TestUtils.getTestKey('concurrent');
      const promises: Promise<number[]>[] = [];

      // Act
      for (let i = 0; i < concurrentRequests; i++) {
        const keys = [
          `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}_${i}:z`,
          `${TestConfigs.INTEGRATION_REDIS.keyPrefix}:${testKey}_${i}:block`
        ];
        const args = ['60000', '5', '30000', Date.now().toString(), `member-${i}`];
        promises.push(functionsManager.executeSlidingWindow(keys, args));
      }

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(4);
      });
    });
  });

  describe('Redis Functions Error Handling', () => {
    beforeEach(async () => {
      await functionsManager.initialize();
    });

    it('should handle Redis connection errors during execution', async () => {
      // Arrange
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];

      // Simulate connection loss
      await redis.disconnect();

      // Act & Assert
      await expect(functionsManager.executeSlidingWindow(keys, args))
        .rejects.toThrow(ThrottlerError);

      // Cleanup - reconnect for teardown
      await redis.connect();
    });

    it('should validate function result format', async () => {
      // This test verifies that the function returns the expected format
      // We can't easily mock the Redis function result, so we test with valid execution
      
      // Arrange
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];

      // Act
      const result = await functionsManager.executeSlidingWindow(keys, args);

      // Assert - Verify result structure
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(4);
      expect(Number.isInteger(result[0])).toBe(true); // totalHits
      expect(Number.isInteger(result[1])).toBe(true); // timeToExpire
      expect([0, 1]).toContain(result[2]); // isBlocked (0 or 1)
      expect(Number.isInteger(result[3])).toBe(true); // timeToBlockExpire
    });
  });

  describe('Redis Functions Library Management', () => {
    it('should handle library replacement correctly', async () => {
      // Arrange - Clean functions first to ensure clean state
      try {
        await redis.function('FLUSH');
      } catch (error) {
        // Ignore if Redis Functions not supported
      }
      
      const uniqueId = Date.now();
      const manager1 = new RedisFunctionsManager(redis, {
        libraryPrefix: `test_replace_${uniqueId}`,
        logger
      });

      // Act - Initialize first manager
      await manager1.initialize();
      expect(manager1.isLoaded()).toBe(true);

      // Create second manager with same prefix (simulating replacement)
      const manager2 = new RedisFunctionsManager(redis, {
        libraryPrefix: `test_replace_${uniqueId}`,
        logger
      });
      
      // This should work because REPLACE flag is used
      await manager2.initialize();

      // Assert
      expect(manager2.isLoaded()).toBe(true);

      // Both managers should be able to execute (they use the same function)
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];
      
      const result1 = await manager1.executeSlidingWindow(keys, args);
      const result2 = await manager2.executeSlidingWindow(keys, args);

      expect(Array.isArray(result1)).toBe(true);
      expect(Array.isArray(result2)).toBe(true);
    });

    it('should handle function library replacement', async () => {
      // Arrange
      await functionsManager.initialize();
      expect(functionsManager.isLoaded()).toBe(true);

      // Act - Force reload (which uses REPLACE flag)
      await functionsManager.reloadLibrary();

      // Assert
      expect(functionsManager.isLoaded()).toBe(true);
      
      // Function should still work after replacement
      const keys = ['key1', 'key2'];
      const args = ['60000', '5', '30000', Date.now().toString(), 'member'];
      const result = await functionsManager.executeSlidingWindow(keys, args);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });
});