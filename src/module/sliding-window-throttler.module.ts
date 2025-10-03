/**
 * @fileoverview Simplified NestJS module for sliding window throttler
 *
 * This module provides clean NestJS integration for the sliding window throttler
 * with simplified configuration and dependency injection.
 */

import { DynamicModule, Module, Provider, Global, Type, ForwardReference } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis, RedisOptions } from 'ioredis';
import { ThrottlerConfig, createConfig } from '../config';
import { KeyGenerator, SlidingWindowThrottlerLogger, SlidingWindowThrottlerConsoleLogger } from '../core';
import { ThrottlerConfigurationError, ThrottlerRedisConnectionError } from '../core/errors';
import { RedisFunctionsManager } from '../redis';
import { SlidingWindowThrottlerStorage } from '../storage';

// Configuration tokens for dependency injection
export const SLIDING_WINDOW_THROTTLER_CONFIG = 'SLIDING_WINDOW_THROTTLER_CONFIG';
export const SLIDING_WINDOW_THROTTLER_REDIS_CLIENT = 'SLIDING_WINDOW_THROTTLER_REDIS_CLIENT';
export const SLIDING_WINDOW_THROTTLER_LOGGER = 'SLIDING_WINDOW_THROTTLER_LOGGER';

/**
 * Simplified async configuration options
 */
export interface SlidingWindowThrottlerAsyncConfig {
  /** Factory function to create configuration dynamically */
  useFactory?: (...args: unknown[]) => Promise<ThrottlerConfig> | ThrottlerConfig;
  /** Dependencies to inject into the factory function */
  inject?: (string | symbol | ((...args: unknown[]) => unknown) | Type<unknown>)[];
  /** Modules to import for the async configuration */
  imports?: (Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference)[];
  /** Logger factory function to create custom logger */
  loggerFactory?: (...args: unknown[]) => SlidingWindowThrottlerLogger;
  /** Dependencies to inject into the logger factory function */
  loggerInject?: (string | symbol | ((...args: unknown[]) => unknown) | Type<unknown>)[];
}

/**
 * Simplified NestJS module for sliding window throttler
 *
 * This module provides clean NestJS integration with simplified configuration
 * and dependency injection setup.
 *
 * @public
 */
@Global()
@Module({})
export class SlidingWindowThrottlerModule {
  /**
   * Configure the module with synchronous configuration
   */
  static forRoot(config?: ThrottlerConfig, logger?: SlidingWindowThrottlerLogger): DynamicModule {
    const providers = this.createProviders(config, logger);

    return {
      module: SlidingWindowThrottlerModule,
      providers,
      exports: [SlidingWindowThrottlerStorage, SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_REDIS_CLIENT],
      global: true,
    };
  }

  /**
   * Configure the module with asynchronous configuration
   */
  static forRootAsync(options: SlidingWindowThrottlerAsyncConfig): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: SlidingWindowThrottlerModule,
      imports: options.imports || [],
      providers: asyncProviders,
      exports: [SlidingWindowThrottlerStorage, SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_REDIS_CLIENT],
      global: true,
    };
  }

  /**
   * Create providers for synchronous configuration
   */
  private static createProviders(config?: ThrottlerConfig, logger?: SlidingWindowThrottlerLogger): Provider[] {
    return [
      // Configuration provider
      {
        provide: SLIDING_WINDOW_THROTTLER_CONFIG,
        useValue: config || createConfig(),
      },
      // Logger provider - use custom logger if provided, otherwise default
      logger
        ? {
            provide: SLIDING_WINDOW_THROTTLER_LOGGER,
            useValue: logger,
          }
        : {
            provide: SLIDING_WINDOW_THROTTLER_LOGGER,
            useFactory: (config: ThrottlerConfig) => {
              return new SlidingWindowThrottlerConsoleLogger(config?.throttler?.enableDebugLogging || false);
            },
            inject: [SLIDING_WINDOW_THROTTLER_CONFIG],
          },
      // Redis client provider
      {
        provide: SLIDING_WINDOW_THROTTLER_REDIS_CLIENT,
        useFactory: (config: ThrottlerConfig, logger: SlidingWindowThrottlerLogger) => {
          return this.createRedisClient(config.redis, logger);
        },
        inject: [SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_LOGGER],
      },
      // Main storage provider
      {
        provide: SlidingWindowThrottlerStorage,
        useFactory: async (redis: Redis, config: ThrottlerConfig, logger: SlidingWindowThrottlerLogger) => {
          // Create key generator with throttler-specific prefix
          const keyGenerator = new KeyGenerator(config.throttler.keyPrefix ? { prefix: config.throttler.keyPrefix } : {});

          // Create Redis Functions Manager
          const functionsManager = new RedisFunctionsManager(redis, {
            logger,
          });

          // Initialize Redis Functions if enabled
          if (config.throttler.enableRedisFunctions) {
            try {
              await functionsManager.initialize();
              logger.info('Redis Functions initialized successfully');
            } catch (error) {
              logger.warn('Failed to initialize Redis Functions, falling back to Lua scripts');
            }
          }

          return new SlidingWindowThrottlerStorage(redis, config, functionsManager, keyGenerator, logger);
        },
        inject: [SLIDING_WINDOW_THROTTLER_REDIS_CLIENT, SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_LOGGER],
      },
      // Provide our storage as the ThrottlerStorage token for @nestjs/throttler integration
      {
        provide: ThrottlerStorage,
        useExisting: SlidingWindowThrottlerStorage,
      },
    ];
  }

  /**
   * Create providers for asynchronous configuration
   */
  private static createAsyncProviders(options: SlidingWindowThrottlerAsyncConfig): Provider[] {
    const configProvider: Provider = {
      provide: SLIDING_WINDOW_THROTTLER_CONFIG,
      useFactory: async (...args: unknown[]) => {
        if (!options.useFactory) {
          throw new ThrottlerConfigurationError('useFactory is required for async configuration');
        }
        const config = await options.useFactory(...args);
        return config || createConfig();
      },
      inject: options.inject || [],
    };

    // Logger provider - use custom factory if provided, otherwise default
    const loggerProvider: Provider = options.loggerFactory
      ? {
          provide: SLIDING_WINDOW_THROTTLER_LOGGER,
          useFactory: options.loggerFactory,
          inject: options.loggerInject || [],
        }
      : {
          provide: SLIDING_WINDOW_THROTTLER_LOGGER,
          useFactory: (config: ThrottlerConfig) => {
            return new SlidingWindowThrottlerConsoleLogger(config?.throttler?.enableDebugLogging || false);
          },
          inject: [SLIDING_WINDOW_THROTTLER_CONFIG],
        };

    return [
      configProvider,
      loggerProvider,
      // Redis client provider
      {
        provide: SLIDING_WINDOW_THROTTLER_REDIS_CLIENT,
        useFactory: (config: ThrottlerConfig, logger: SlidingWindowThrottlerLogger) => {
          return this.createRedisClient(config.redis, logger);
        },
        inject: [SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_LOGGER],
      },
      // Main storage provider
      {
        provide: SlidingWindowThrottlerStorage,
        useFactory: async (redis: Redis, config: ThrottlerConfig, logger: SlidingWindowThrottlerLogger) => {
          // Create key generator with throttler-specific prefix
          const keyGenerator = new KeyGenerator(config.throttler.keyPrefix ? { prefix: config.throttler.keyPrefix } : {});

          // Create Redis Functions Manager
          const functionsManager = new RedisFunctionsManager(redis, {
            logger,
          });

          // Initialize Redis Functions if enabled
          if (config.throttler.enableRedisFunctions) {
            try {
              await functionsManager.initialize();
              logger.info('Redis Functions initialized successfully');
            } catch (error) {
              logger.warn('Failed to initialize Redis Functions, falling back to Lua scripts');
            }
          }

          return new SlidingWindowThrottlerStorage(redis, config, functionsManager, keyGenerator, logger);
        },
        inject: [SLIDING_WINDOW_THROTTLER_REDIS_CLIENT, SLIDING_WINDOW_THROTTLER_CONFIG, SLIDING_WINDOW_THROTTLER_LOGGER],
      },
      // Provide our storage as the ThrottlerStorage token for @nestjs/throttler integration
      {
        provide: ThrottlerStorage,
        useExisting: SlidingWindowThrottlerStorage,
      },
    ];
  }

  /**
   * Create Redis client instance
   */
  private static createRedisClient(config: ThrottlerConfig['redis'], logger: SlidingWindowThrottlerLogger): Redis {
    try {
      const redisOptions: RedisOptions = {
        host: config.host,
        port: config.port,
        db: config.db || 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Add optional properties
      if (config.password) {
        redisOptions.password = config.password;
      }
      if (config.keyPrefix) {
        redisOptions.keyPrefix = config.keyPrefix;
      }

      const redis = new Redis(redisOptions);

      // Add basic error handling
      redis.on('error', (error) => {
        logger.error('Redis connection error', error);
      });

      redis.on('connect', () => {
        logger.info(`Redis connected to ${config.host}:${config.port}`);
      });

      redis.on('ready', () => {
        logger.info('Redis ready for commands');
      });

      redis.on('close', () => {
        logger.warn('Redis connection closed');
      });

      return redis;
    } catch (error) {
      throw new ThrottlerRedisConnectionError(
        `Failed to create Redis client: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
