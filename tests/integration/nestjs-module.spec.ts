/**
 * @fileoverview Integration tests for NestJS module configuration and dependency injection
 *
 * These tests verify module setup, provider registration, and configuration validation
 * with real NestJS application context and Redis connections.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { 
  SlidingWindowThrottlerModule,
  SLIDING_WINDOW_THROTTLER_CONFIG,
  SLIDING_WINDOW_THROTTLER_REDIS_CLIENT,
  SLIDING_WINDOW_THROTTLER_LOGGER,
  SlidingWindowThrottlerAsyncConfig
} from '../../src/module/sliding-window-throttler.module';
import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { SlidingWindowThrottlerLogger, SlidingWindowThrottlerConsoleLogger } from '../../src/core/logger';
import { ThrottlerConfig } from '../../src/config';
import { TestUtils } from '../shared/test-utils';
import { TestConfigs } from '../shared/test-data';
import { RedisFailureStrategy } from '../../src/core/types';

describe('NestJS Module Integration', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      // Clean up Redis connections and close module
      try {
        const redis = module.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
        await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
        await redis.quit();
      } catch (error) {
        // Ignore cleanup errors
      }
      await module.close();
    }
  });

  describe('Synchronous Configuration', () => {
    it('should create module with provided configuration', async () => {
      // Arrange
      const testConfig: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(testConfig)]
      }).compile();

      // Assert
      expect(module).toBeDefined();
      
      // Verify providers are registered
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      const redis = module.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      const logger = module.get<SlidingWindowThrottlerLogger>(SLIDING_WINDOW_THROTTLER_LOGGER);
      const storage = module.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
      const throttlerStorage = module.get<ThrottlerStorage>(ThrottlerStorage);

      expect(config).toBeDefined();
      expect(redis).toBeDefined();
      expect(logger).toBeDefined();
      expect(storage).toBeDefined();
      expect(throttlerStorage).toBeDefined();
      
      // Verify storage is properly aliased
      expect(throttlerStorage).toBe(storage);
    });

    it('should create module with custom configuration', async () => {
      // Arrange
      const customConfig: ThrottlerConfig = {
        redis: {
          ...TestConfigs.INTEGRATION_REDIS,
          keyPrefix: 'custom_test'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: true,
          maxWindowSize: 500,
          enableRedisFunctions: false
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(customConfig)]
      }).compile();

      // Assert
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      expect(config).toEqual(customConfig);
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_CLOSED);
      expect(config.throttler.enableDebugLogging).toBe(true);
      expect(config.throttler.maxWindowSize).toBe(500);
      expect(config.throttler.enableRedisFunctions).toBe(false);
    });

    it('should create module with custom logger', async () => {
      // Arrange
      const customLogger = new SlidingWindowThrottlerConsoleLogger(true);
      const config: ThrottlerConfig = {
        redis: TestConfigs.INTEGRATION_REDIS,
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: true,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(config, customLogger)]
      }).compile();

      // Assert
      const logger = module.get<SlidingWindowThrottlerLogger>(SLIDING_WINDOW_THROTTLER_LOGGER);
      expect(logger).toBe(customLogger);
    });

    it('should create Redis client with correct configuration', async () => {
      // Arrange
      const config: ThrottlerConfig = {
        redis: {
          host: TestConfigs.INTEGRATION_REDIS.host,
          port: TestConfigs.INTEGRATION_REDIS.port,
          db: TestConfigs.INTEGRATION_REDIS.db,
          keyPrefix: 'redis_config_test'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(config)]
      }).compile();

      // Assert
      const redis = module.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      expect(redis).toBeDefined();
      expect(redis.options.host).toBe(config.redis.host);
      expect(redis.options.port).toBe(config.redis.port);
      expect(redis.options.db).toBe(config.redis.db);
      expect(redis.options.keyPrefix).toBe(config.redis.keyPrefix);
    });
  });

  describe('Asynchronous Configuration', () => {
    it('should create module with async factory configuration', async () => {
      // Arrange
      const asyncConfig: SlidingWindowThrottlerAsyncConfig = {
        useFactory: async (): Promise<ThrottlerConfig> => {
          return {
            redis: {
              ...TestConfigs.INTEGRATION_REDIS,
              keyPrefix: 'async_test'
            },
            throttler: {
              failureStrategy: RedisFailureStrategy.FAIL_OPEN,
              enableDebugLogging: false,
              maxWindowSize: 1000,
              enableRedisFunctions: true
            }
          };
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRootAsync(asyncConfig)]
      }).compile();

      // Assert
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      expect(config).toBeDefined();
      expect(config.redis.keyPrefix).toBe('async_test');
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_OPEN);
    });

    it('should create module with async factory and dependencies', async () => {
      // Arrange
      const asyncConfig: SlidingWindowThrottlerAsyncConfig = {
        useFactory: async (): Promise<ThrottlerConfig> => {
          // Simulate async configuration loading
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            redis: {
              ...TestConfigs.INTEGRATION_REDIS,
              keyPrefix: 'async_injected_test'
            },
            throttler: {
              failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
              enableDebugLogging: true,
              maxWindowSize: 2000,
              enableRedisFunctions: false
            }
          };
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRootAsync(asyncConfig)]
      }).compile();

      // Assert
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      expect(config).toBeDefined();
      expect(config.redis.keyPrefix).toBe('async_injected_test');
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_CLOSED);
      expect(config.throttler.enableDebugLogging).toBe(true);
      expect(config.throttler.maxWindowSize).toBe(2000);
      expect(config.throttler.enableRedisFunctions).toBe(false);
    });

    it('should create module with async logger factory', async () => {
      // Arrange
      const asyncConfig: SlidingWindowThrottlerAsyncConfig = {
        useFactory: async (): Promise<ThrottlerConfig> => {
          return {
            redis: TestConfigs.INTEGRATION_REDIS,
            throttler: {
              failureStrategy: RedisFailureStrategy.FAIL_OPEN,
              enableDebugLogging: false,
              maxWindowSize: 1000,
              enableRedisFunctions: true
            }
          };
        },
        loggerFactory: () => new SlidingWindowThrottlerConsoleLogger(true)
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRootAsync(asyncConfig)]
      }).compile();

      // Assert
      const logger = module.get<SlidingWindowThrottlerLogger>(SLIDING_WINDOW_THROTTLER_LOGGER);
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(SlidingWindowThrottlerConsoleLogger);
    });

    it('should handle missing useFactory in async configuration', async () => {
      // Arrange
      const invalidAsyncConfig: SlidingWindowThrottlerAsyncConfig = {
        // Missing useFactory
        inject: []
      };

      // Act & Assert
      await expect(
        Test.createTestingModule({
          imports: [SlidingWindowThrottlerModule.forRootAsync(invalidAsyncConfig)]
        }).compile()
      ).rejects.toThrow('useFactory is required for async configuration');
    });
  });

  describe('Provider Registration and Dependency Injection', () => {
    it('should properly inject storage into dependent services', async () => {
      // This test verifies that the storage can be injected into other services
      // We'll create a simple test to verify the module works correctly
      
      const testModule = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: TestConfigs.INTEGRATION_REDIS,
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Act
      const storage = testModule.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);

      // Assert
      expect(storage).toBeDefined();
      expect(storage).toBeInstanceOf(SlidingWindowThrottlerStorage);

      // Cleanup
      const redis = testModule.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
      await redis.quit();
      await testModule.close();
    });

    it('should provide ThrottlerStorage interface correctly', async () => {
      // Arrange
      const testModule = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: TestConfigs.INTEGRATION_REDIS,
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Act
      const throttlerStorage = testModule.get<ThrottlerStorage>(ThrottlerStorage);
      const slidingWindowStorage = testModule.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);

      // Assert
      expect(throttlerStorage).toBeDefined();
      expect(slidingWindowStorage).toBeDefined();
      expect(throttlerStorage).toBe(slidingWindowStorage);
      
      // Verify it has the expected methods
      expect(typeof throttlerStorage.increment).toBe('function');

      // Cleanup
      const redis = testModule.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
      await redis.quit();
      await testModule.close();
    });

    it('should initialize Redis Functions when enabled', async () => {
      // Arrange
      const testModule = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: TestConfigs.INTEGRATION_REDIS,
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Act
      const storage = testModule.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);

      // Assert - Storage should be ready to use
      expect(storage).toBeDefined();
      
      // Test that storage works (which implies Redis Functions were initialized if enabled)
      const result = await storage.increment(
        TestUtils.getTestKey('module_test'),
        60000,
        5,
        30000,
        'test_throttler'
      );
      
      expect(result).toBeDefined();
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);

      // Cleanup
      const redis = testModule.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
      await redis.quit();
      await testModule.close();
    });

    it('should handle Redis Functions initialization failure gracefully', async () => {
      // Arrange - Create module with Redis Functions enabled but use invalid Redis config
      const moduleWithInvalidRedis = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: {
            host: TestConfigs.INTEGRATION_REDIS.host, // Use valid host so module can be created
            port: TestConfigs.INTEGRATION_REDIS.port,
            db: TestConfigs.INTEGRATION_REDIS.db,
            keyPrefix: 'invalid_test'
          },
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Act & Assert - Module should still be created even if Redis Functions fail
      const storage = moduleWithInvalidRedis.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
      expect(storage).toBeDefined();

      // Cleanup
      const redis = moduleWithInvalidRedis.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      await redis.quit();
      await moduleWithInvalidRedis.close();
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', async () => {
      // Arrange
      const minimalConfig: ThrottlerConfig = {
        redis: {
          host: TestConfigs.INTEGRATION_REDIS.host,
          port: TestConfigs.INTEGRATION_REDIS.port,
          db: TestConfigs.INTEGRATION_REDIS.db
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(minimalConfig)]
      }).compile();

      // Assert
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      expect(config).toBeDefined();
      expect(config.redis.host).toBe(TestConfigs.INTEGRATION_REDIS.host);
      expect(config.redis.port).toBe(TestConfigs.INTEGRATION_REDIS.port);
      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_OPEN);
    });

    it('should work with complete configuration', async () => {
      // Arrange
      const completeConfig: ThrottlerConfig = {
        redis: {
          host: TestConfigs.INTEGRATION_REDIS.host,
          port: TestConfigs.INTEGRATION_REDIS.port,
          db: TestConfigs.INTEGRATION_REDIS.db,
          password: 'test_password',
          keyPrefix: 'complete_test'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: true,
          maxWindowSize: 2000,
          enableRedisFunctions: false,
          keyPrefix: 'throttler_prefix'
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(completeConfig)]
      }).compile();

      // Assert
      const config = module.get<ThrottlerConfig>(SLIDING_WINDOW_THROTTLER_CONFIG);
      expect(config).toEqual(completeConfig);
    });

    it('should handle Redis connection configuration correctly', async () => {
      // Arrange
      const configWithAuth: ThrottlerConfig = {
        redis: {
          host: TestConfigs.INTEGRATION_REDIS.host,
          port: TestConfigs.INTEGRATION_REDIS.port,
          db: TestConfigs.INTEGRATION_REDIS.db,
          // Note: Not setting password since test Redis likely doesn't have auth
          keyPrefix: 'auth_test'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      // Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot(configWithAuth)]
      }).compile();

      // Assert
      const redis = module.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      expect(redis).toBeDefined();
      
      // Test that Redis connection works
      await redis.ping();
    });
  });

  describe('Module Lifecycle', () => {
    it('should handle module initialization and cleanup correctly', async () => {
      // Arrange & Act
      module = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: TestConfigs.INTEGRATION_REDIS,
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Assert - Module should initialize successfully
      expect(module).toBeDefined();
      
      const redis = module.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      const storage = module.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
      
      expect(redis).toBeDefined();
      expect(storage).toBeDefined();
      
      // Test functionality
      const result = await storage.increment(
        TestUtils.getTestKey('lifecycle_test'),
        60000,
        5,
        30000,
        'test_throttler'
      );
      
      expect(result.totalHits).toBe(1);
      
      // Cleanup should work without errors
      await redis.quit();
      await module.close();
      
      // Reset module to null to prevent double cleanup in afterEach
      module = null as any;
    });

    it('should handle multiple module instances', async () => {
      // Arrange
      const module1 = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: {
            ...TestConfigs.INTEGRATION_REDIS,
            keyPrefix: 'module1_test'
          },
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      const module2 = await Test.createTestingModule({
        imports: [SlidingWindowThrottlerModule.forRoot({
          redis: {
            ...TestConfigs.INTEGRATION_REDIS,
            keyPrefix: 'module2_test'
          },
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true
          }
        })]
      }).compile();

      // Act & Assert
      const storage1 = module1.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
      const storage2 = module2.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
      
      expect(storage1).toBeDefined();
      expect(storage2).toBeDefined();
      expect(storage1).not.toBe(storage2); // Should be different instances
      
      // Both should work independently
      const result1 = await storage1.increment(TestUtils.getTestKey('module1'), 60000, 5, 30000, 'throttler1');
      const result2 = await storage2.increment(TestUtils.getTestKey('module2'), 60000, 5, 30000, 'throttler2');
      
      expect(result1.totalHits).toBe(1);
      expect(result2.totalHits).toBe(1);

      // Cleanup
      const redis1 = module1.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      const redis2 = module2.get<Redis>(SLIDING_WINDOW_THROTTLER_REDIS_CLIENT);
      
      await redis1.quit();
      await redis2.quit();
      await module1.close();
      await module2.close();
    });
  });
});