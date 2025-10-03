/**
 * @fileoverview Test environment setup utilities for nestjs-sliding-window-throttler
 *
 * This module provides interfaces and utilities for setting up integration and E2E
 * test environments with proper TypeScript types and cleanup mechanisms.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { RedisFunctionsManager } from '../../src/redis/redis-functions.manager';
import { KeyGenerator } from '../../src/core/key-generator';
import { SlidingWindowThrottlerLogger } from '../../src/core/logger';
import { ThrottlerConfig, RedisConfig } from '../../src/config';
import { SlidingWindowThrottlerModule } from '../../src/module';
import { ThrottlerError, ThrottlerErrorCode } from '../../src/core/errors';
import { TestUtils } from './test-utils';
import { MockFactories } from './mock-factories';
import { TestConfigs, TestConstants } from './test-data';

/**
 * Integration test environment interface with Redis, storage, and cleanup methods
 */
export interface IntegrationTestEnvironment {
  /** Redis client instance */
  redis: Redis;
  /** Sliding window throttler storage instance */
  storage: SlidingWindowThrottlerStorage;
  /** Redis Functions Manager instance */
  functionsManager: RedisFunctionsManager;
  /** Key generator instance */
  keyGenerator: KeyGenerator;
  /** Logger instance */
  logger: SlidingWindowThrottlerLogger;
  /** Test configuration */
  config: ThrottlerConfig;
  /** Cleanup function to call after tests */
  cleanup(): Promise<void>;
}

/**
 * E2E test environment interface with NestJS app and Redis setup
 */
export interface E2ETestEnvironment {
  /** NestJS application instance */
  app: INestApplication;
  /** Redis client instance */
  redis: Redis;
  /** Sliding window throttler storage instance */
  storage: SlidingWindowThrottlerStorage;
  /** Test configuration */
  config: ThrottlerConfig;
  /** Cleanup function to call after tests */
  cleanup(): Promise<void>;
}

/**
 * Test environment configuration options
 */
export interface TestEnvironmentOptions {
  /** Custom configuration overrides */
  config?: Partial<ThrottlerConfig>;
  /** Whether to enable debug logging */
  enableDebugLogging?: boolean;
  /** Whether to use Redis Functions (default: true) */
  enableRedisFunctions?: boolean;
  /** Custom Redis connection options */
  redisOptions?: Partial<RedisConfig>;
}

/**
 * Factory class for creating test environments
 */
export class TestEnvironmentFactory {
  /**
   * Create an integration test environment with real Redis
   * 
   * @param options - Environment configuration options
   * @returns Promise resolving to integration test environment
   */
  static async createIntegrationEnvironment(
    options: TestEnvironmentOptions = {}
  ): Promise<IntegrationTestEnvironment> {
    try {
      // Create test configuration
      const config = TestEnvironmentFactory.createTestConfig(options);

      // Create Redis client
      const redis = await TestEnvironmentFactory.createRedisClient(config);

      // Create logger
      const logger = MockFactories.createMockLogger();

      // Create key generator
      const keyGenerator = MockFactories.createKeyGenerator({
        prefix: config.redis.keyPrefix
      });

      // Create Redis Functions Manager
      const functionsManager = new RedisFunctionsManager(redis, { logger });

      // Initialize Redis Functions if enabled
      if (config.throttler.enableRedisFunctions) {
        try {
          await functionsManager.initialize();
        } catch (error) {
          // Log warning but continue - tests can still run with Lua scripts
          console.warn('Failed to initialize Redis Functions in test environment:', error);
        }
      }

      // Create storage instance
      const storage = new SlidingWindowThrottlerStorage(
        redis,
        config,
        functionsManager,
        keyGenerator,
        logger
      );

      // Clean any existing test data
      await TestUtils.cleanRedis(redis, `${config.redis.keyPrefix}:*`);

      return {
        redis,
        storage,
        functionsManager,
        keyGenerator,
        logger,
        config,
        cleanup: async () => {
          await TestEnvironmentFactory.cleanupIntegrationEnvironment({
            redis,
            storage,
            functionsManager,
            keyGenerator,
            logger,
            config,
            cleanup: async () => { } // Prevent recursion
          });
        }
      };
    } catch (error) {
      throw new ThrottlerError(
        `Failed to create integration test environment: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create an E2E test environment with NestJS application
   * 
   * @param options - Environment configuration options
   * @returns Promise resolving to E2E test environment
   */
  static async createE2EEnvironment(
    options: TestEnvironmentOptions = {}
  ): Promise<E2ETestEnvironment> {
    try {
      // Create test configuration
      const config = TestEnvironmentFactory.createTestConfig(options);

      // Create NestJS testing module
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          SlidingWindowThrottlerModule.forRoot(config)
        ]
      }).compile();

      // Create NestJS application
      const app = moduleFixture.createNestApplication();
      await app.init();

      // Get instances from DI container
      const redis = app.get<Redis>('SLIDING_WINDOW_THROTTLER_REDIS_CLIENT');
      const storage = app.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);

      // Clean any existing test data
      await TestUtils.cleanRedis(redis, `${config.redis.keyPrefix}:*`);

      return {
        app,
        redis,
        storage,
        config,
        cleanup: async () => {
          await TestEnvironmentFactory.cleanupE2EEnvironment({
            app,
            redis,
            storage,
            config,
            cleanup: async () => { } // Prevent recursion
          });
        }
      };
    } catch (error) {
      throw new ThrottlerError(
        `Failed to create E2E test environment: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create a test configuration with proper defaults and overrides
   * 
   * @param options - Configuration options
   * @returns Test configuration
   */
  private static createTestConfig(options: TestEnvironmentOptions): ThrottlerConfig {
    let baseConfig = { ...TestConfigs.INTEGRATION_REDIS };

    // Apply Redis options if provided
    if (options.redisOptions) {
      baseConfig = { ...baseConfig, ...options.redisOptions };
    }

    const throttlerConfig = MockFactories.createThrottlerConfig('minimal', {
      redis: baseConfig,
      ...options.config
    });

    // Apply throttler options
    if (options.enableDebugLogging !== undefined) {
      throttlerConfig.throttler.enableDebugLogging = options.enableDebugLogging;
    }
    if (options.enableRedisFunctions !== undefined) {
      throttlerConfig.throttler.enableRedisFunctions = options.enableRedisFunctions;
    }
    if (options.config?.throttler) {
      Object.assign(throttlerConfig.throttler, options.config.throttler);
    }

    return throttlerConfig;
  }

  /**
   * Create a Redis client for testing
   * 
   * @param config - Test configuration
   * @returns Promise resolving to Redis client
   */
  private static async createRedisClient(config: ThrottlerConfig): Promise<Redis> {
    const redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      keyPrefix: config.redis.keyPrefix
    });

    try {
      // Test connection
      await redis.ping();
      return redis;
    } catch (error) {
      await redis.disconnect();
      throw new ThrottlerError(
        `Failed to connect to Redis: ${error}`,
        ThrottlerErrorCode.REDIS_CONNECTION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Cleanup integration test environment
   * 
   * @param environment - Integration test environment to cleanup
   */
  private static async cleanupIntegrationEnvironment(
    environment: IntegrationTestEnvironment
  ): Promise<void> {
    try {
      // Clean test data
      await TestUtils.cleanRedis(environment.redis, `${environment.config.redis.keyPrefix}:*`);

      // Disconnect Redis
      await environment.redis.disconnect();
    } catch (error) {
      console.warn('Error during integration environment cleanup:', error);
    }
  }

  /**
   * Cleanup E2E test environment
   * 
   * @param environment - E2E test environment to cleanup
   */
  private static async cleanupE2EEnvironment(
    environment: E2ETestEnvironment
  ): Promise<void> {
    try {
      // Clean test data
      await TestUtils.cleanRedis(environment.redis, `${environment.config.redis.keyPrefix}:*`);

      // Close NestJS application
      await environment.app.close();
    } catch (error) {
      console.warn('Error during E2E environment cleanup:', error);
    }
  }
}

/**
 * Utility functions for test environment management
 */
export class TestEnvironmentUtils {
  /**
   * Wait for Redis to be ready
   * 
   * @param redis - Redis client
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Promise that resolves when Redis is ready
   */
  static async waitForRedis(redis: Redis, timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await redis.ping();
        return;
      } catch (error) {
        await TestUtils.wait(100);
      }
    }

    throw new ThrottlerError(
      `Redis not ready after ${timeoutMs}ms`,
      ThrottlerErrorCode.REDIS_CONNECTION_FAILED
    );
  }

  /**
   * Verify test environment is properly set up
   * 
   * @param environment - Test environment to verify
   * @returns Promise that resolves if environment is valid
   */
  static async verifyIntegrationEnvironment(
    environment: IntegrationTestEnvironment
  ): Promise<void> {
    // Test Redis connection
    await environment.redis.ping();

    // Test storage functionality
    const testKey = TestUtils.getTestKey('verify');
    const result = await environment.storage.increment(
      testKey,
      60000,
      5,
      0,
      'verification'
    );

    // Validate result
    TestUtils.validateThrottlerRecord(result);

    // Clean up test data
    await environment.storage.reset(testKey);
  }

  /**
   * Verify E2E environment is properly set up
   * 
   * @param environment - E2E test environment to verify
   * @returns Promise that resolves if environment is valid
   */
  static async verifyE2EEnvironment(
    environment: E2ETestEnvironment
  ): Promise<void> {
    // Test application is running
    if (!environment.app) {
      throw new Error('NestJS application not initialized');
    }

    // Test Redis connection
    await environment.redis.ping();

    // Test storage functionality
    const testKey = TestUtils.getTestKey('e2e_verify');
    const result = await environment.storage.increment(
      testKey,
      60000,
      5,
      0,
      'e2e_verification'
    );

    // Validate result
    TestUtils.validateThrottlerRecord(result);

    // Clean up test data
    await environment.storage.reset(testKey);
  }

  /**
   * Create multiple test environments for parallel testing
   * 
   * @param count - Number of environments to create
   * @param options - Environment options
   * @returns Promise resolving to array of integration environments
   */
  static async createMultipleIntegrationEnvironments(
    count: number,
    options: TestEnvironmentOptions = {}
  ): Promise<IntegrationTestEnvironment[]> {
    const environments: IntegrationTestEnvironment[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const envOptions: TestEnvironmentOptions = {
          ...options,
          config: {
            ...options.config,
            redis: {
              host: TestConstants.REDIS.DEFAULT_HOST,
              port: TestConstants.REDIS.DEFAULT_PORT,
              db: TestConstants.REDIS.INTEGRATION_DB,
              ...options.config?.redis,
              keyPrefix: `${options.config?.redis?.keyPrefix || 'test'}_${i}`
            }
          }
        };

        const environment = await TestEnvironmentFactory.createIntegrationEnvironment(envOptions);
        environments.push(environment);
      }

      return environments;
    } catch (error) {
      // Cleanup any created environments on failure
      await Promise.all(environments.map(env => env.cleanup()));
      throw error;
    }
  }

  /**
   * Cleanup multiple test environments
   * 
   * @param environments - Array of environments to cleanup
   */
  static async cleanupMultipleEnvironments(
    environments: IntegrationTestEnvironment[]
  ): Promise<void> {
    await Promise.all(environments.map(env => env.cleanup()));
  }
}