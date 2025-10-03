/**
 * @fileoverview Integration tests for failure strategy error handling with real Redis failures
 *
 * These tests verify FAIL_OPEN and FAIL_CLOSED behaviors using enums instead of magic strings,
 * simulate Redis connection failures, and validate recovery behavior.
 */

import { Redis } from 'ioredis';
import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { RedisFunctionsManager } from '../../src/redis/redis-functions.manager';
import { KeyGenerator } from '../../src/core/key-generator';
import { SlidingWindowThrottlerConsoleLogger } from '../../src/core/logger';
import { TestUtils } from '../shared/test-utils';
import { TestConstants, TestConfigs } from '../shared/test-data';
import { RedisFailureStrategy } from '../../src/core/types';
import { ThrottlerConfig } from '../../src/config';
import { ThrottlerError, ThrottlerRedisConnectionError } from '../../src/core/errors';

describe('Failure Strategies Integration', () => {
  let redis: Redis;
  let logger: SlidingWindowThrottlerConsoleLogger;
  let keyGenerator: KeyGenerator;

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

    // Create key generator
    keyGenerator = new KeyGenerator({ prefix: TestConfigs.INTEGRATION_REDIS.keyPrefix });

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

    // Wait a bit to ensure cleanup is complete
    await TestUtils.wait(50);
  });

  describe('FAIL_OPEN Strategy', () => {
    it('should allow requests when Redis is available with FAIL_OPEN strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act
      const result = await storage.increment(
        TestUtils.getTestKey('fail_open_normal'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBeGreaterThan(0);
    });

    it('should handle Redis disconnection gracefully with FAIL_OPEN strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Make a successful request first
      const beforeDisconnect = await storage.increment(
        TestUtils.getTestKey('fail_open_disconnect'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );
      expect(beforeDisconnect.isBlocked).toBe(false);

      // Simulate disconnection
      await redis.disconnect();

      // Act - Try to make a request while disconnected
      const duringDisconnect = await storage.increment(
        TestUtils.getTestKey('fail_open_disconnect'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should allow requests with FAIL_OPEN strategy
      expect(duringDisconnect.isBlocked).toBe(false);
      expect(duringDisconnect.totalHits).toBe(1); // Default fallback value

      // Reconnect for cleanup
      await redis.connect();
    });

    it('should recover after Redis reconnection with FAIL_OPEN strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      const testKey = TestUtils.getTestKey('fail_open_recovery');

      // Disconnect and make request during disconnection
      await redis.disconnect();
      const duringDisconnect = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);
      expect(duringDisconnect.isBlocked).toBe(false);

      // Reconnect
      await redis.connect();
      
      // Reinitialize Redis Functions after reconnection
      await functionsManager.initialize();

      // Act - Make request after reconnection
      const afterReconnect = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);

      // Assert - Should work normally after reconnection
      expect(afterReconnect.isBlocked).toBe(false);
      expect(afterReconnect.totalHits).toBeGreaterThan(0);
    });

    it('should use enum values correctly for FAIL_OPEN strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN, // Using enum, not magic string
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Assert - Verify enum value is used correctly
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_OPEN);
      expect(config.throttler.failureStrategy).toBe('fail-open'); // Enum value
      expect(config.throttler.failureStrategy).not.toBe('FAIL_OPEN'); // Not magic string
    });
  });

  describe('FAIL_CLOSED Strategy', () => {
    it('should allow requests when Redis is available with FAIL_CLOSED strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act
      const result = await storage.increment(
        TestUtils.getTestKey('fail_closed_normal'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
      expect(result.timeToExpire).toBeGreaterThan(0);
    });

    it('should block requests when Redis is disconnected with FAIL_CLOSED strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Make a successful request first
      const beforeDisconnect = await storage.increment(
        TestUtils.getTestKey('fail_closed_disconnect'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );
      expect(beforeDisconnect.isBlocked).toBe(false);

      // Simulate disconnection
      await redis.disconnect();

      // Act - Try to make a request while disconnected
      const duringDisconnect = await storage.increment(
        TestUtils.getTestKey('fail_closed_disconnect'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should block requests with FAIL_CLOSED strategy
      expect(duringDisconnect.isBlocked).toBe(true);
      expect(duringDisconnect.totalHits).toBeGreaterThan(1000); // High number indicates blocked

      // Reconnect for cleanup
      await redis.connect();
    });

    it('should recover after Redis reconnection with FAIL_CLOSED strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      const testKey = TestUtils.getTestKey('fail_closed_recovery');

      // Disconnect and make request during disconnection
      await redis.disconnect();
      const duringDisconnect = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);
      expect(duringDisconnect.isBlocked).toBe(true);

      // Reconnect
      await redis.connect();
      
      // Reinitialize Redis Functions after reconnection
      await functionsManager.initialize();

      // Act - Make request after reconnection
      const afterReconnect = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);

      // Assert - Should work normally after reconnection
      expect(afterReconnect.isBlocked).toBe(false);
      expect(afterReconnect.totalHits).toBeGreaterThan(0);
    });

    it('should use enum values correctly for FAIL_CLOSED strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED, // Using enum, not magic string
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Assert - Verify enum value is used correctly
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_CLOSED);
      expect(config.throttler.failureStrategy).toBe('fail-closed'); // Enum value
      expect(config.throttler.failureStrategy).not.toBe('FAIL_CLOSED'); // Not magic string
    });
  });

  describe('Strategy Comparison', () => {
    it('should behave differently between FAIL_OPEN and FAIL_CLOSED during Redis failures', async () => {
      // Arrange
      const failOpenConfig: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const failClosedConfig: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const functionsManager1 = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_open_${uniqueId}`,
        logger
      });

      await functionsManager1.initialize();

      // Clean functions before initializing second manager
      await redis.function('FLUSH');
      
      const functionsManager2 = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_closed_${uniqueId}`,
        logger
      });

      await functionsManager2.initialize();

      const failOpenStorage = new SlidingWindowThrottlerStorage(
        redis,
        failOpenConfig,
        functionsManager1,
        keyGenerator,
        logger
      );

      const failClosedStorage = new SlidingWindowThrottlerStorage(
        redis,
        failClosedConfig,
        functionsManager2,
        keyGenerator,
        logger
      );

      // Disconnect Redis
      await redis.disconnect();

      // Act - Make requests with both strategies during disconnection
      const failOpenResult = await failOpenStorage.increment(
        TestUtils.getTestKey('comparison_open'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      const failClosedResult = await failClosedStorage.increment(
        TestUtils.getTestKey('comparison_closed'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Different behaviors
      expect(failOpenResult.isBlocked).toBe(false); // FAIL_OPEN allows requests
      expect(failClosedResult.isBlocked).toBe(true); // FAIL_CLOSED blocks requests

      // Reconnect for cleanup
      await redis.connect();
    });

    it('should both work normally when Redis is available', async () => {
      // Arrange
      const failOpenConfig: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const failClosedConfig: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const functionsManager1 = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_open_normal_${uniqueId}`,
        logger
      });

      await functionsManager1.initialize();

      // Clean functions before initializing second manager
      await redis.function('FLUSH');
      
      const functionsManager2 = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_closed_normal_${uniqueId}`,
        logger
      });

      await functionsManager2.initialize();

      const failOpenStorage = new SlidingWindowThrottlerStorage(
        redis,
        failOpenConfig,
        functionsManager1,
        keyGenerator,
        logger
      );

      const failClosedStorage = new SlidingWindowThrottlerStorage(
        redis,
        failClosedConfig,
        functionsManager2,
        keyGenerator,
        logger
      );

      // Act - Make requests with both strategies when Redis is available
      const failOpenResult = await failOpenStorage.increment(
        TestUtils.getTestKey('normal_open'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      const failClosedResult = await failClosedStorage.increment(
        TestUtils.getTestKey('normal_closed'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Both should work normally
      expect(failOpenResult.isBlocked).toBe(false);
      expect(failClosedResult.isBlocked).toBe(false);
      expect(failOpenResult.totalHits).toBe(1);
      expect(failClosedResult.totalHits).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis Functions failure with FAIL_OPEN strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_func_fail_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Flush Redis Functions to simulate failure
      await redis.function('FLUSH');

      // Act - Make request when Redis Functions are not available
      const result = await storage.increment(
        TestUtils.getTestKey('func_fail_open'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should fall back to Lua script and work
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });

    it('should handle Redis Functions failure with FAIL_CLOSED strategy', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_func_fail_closed_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Flush Redis Functions to simulate failure
      await redis.function('FLUSH');

      // Act - Make request when Redis Functions are not available
      const result = await storage.increment(
        TestUtils.getTestKey('func_fail_closed'),
        60000,
        5,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );

      // Assert - Should fall back to Lua script and work
      expect(result.isBlocked).toBe(false);
      expect(result.totalHits).toBe(1);
    });

    it('should handle temporary Redis connection issues', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_temp_fail_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      const testKey = TestUtils.getTestKey('temp_connection');

      // Make successful request
      const before = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);
      expect(before.isBlocked).toBe(false);

      // Simulate temporary disconnection
      await redis.disconnect();
      
      // Make request during disconnection
      const during = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);
      expect(during.isBlocked).toBe(false); // FAIL_OPEN allows requests

      // Reconnect and reinitialize
      await redis.connect();
      await functionsManager.initialize();

      // Make request after recovery
      const after = await storage.increment(testKey, 60000, 5, 30000, TestConstants.THROTTLER_NAMES.API);
      expect(after.isBlocked).toBe(false);
      expect(after.totalHits).toBeGreaterThan(0);
    });
  });

  describe('Performance with Failure Strategies', () => {
    it('should maintain performance with FAIL_OPEN strategy during normal operation', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_perf_open_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act
      const startTime = Date.now();
      await storage.increment(
        TestUtils.getTestKey('perf_fail_open'),
        60000,
        100,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );
      const duration = Date.now() - startTime;

      // Assert - Should complete within performance benchmark
      expect(duration).toBeLessThan(1000); // 1 second for integration tests
    });

    it('should maintain performance with FAIL_CLOSED strategy during normal operation', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const functionsManager = new RedisFunctionsManager(redis, {
        libraryPrefix: `${TestConfigs.INTEGRATION_REDIS.keyPrefix}_perf_closed_${Date.now()}`,
        logger
      });
      await functionsManager.initialize();

      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Act
      const startTime = Date.now();
      await storage.increment(
        TestUtils.getTestKey('perf_fail_closed'),
        60000,
        100,
        30000,
        TestConstants.THROTTLER_NAMES.API
      );
      const duration = Date.now() - startTime;

      // Assert - Should complete within performance benchmark
      expect(duration).toBeLessThan(1000); // 1 second for integration tests
    });
  });
});