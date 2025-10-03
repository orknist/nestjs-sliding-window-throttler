/**
 * @fileoverview TypeScript-safe mock factories for nestjs-sliding-window-throttler tests
 *
 * This module provides factory functions for creating properly typed mocks
 * of Redis, Config, Logger, and other dependencies. All mocks are type-safe
 * and follow professional standards without using 'any' types.
 */

import { Redis } from 'ioredis';
import { ThrottlerConfig, RedisConfig } from '../../src/config';
import { RedisFailureStrategy } from '../../src/core/types';
import { SlidingWindowThrottlerLogger } from '../../src/core/logger';
import { KeyGenerator, KeyGenerationStrategy } from '../../src/core/key-generator';
import { RedisFunctionsManager } from '../../src/redis/redis-functions.manager';
import { RedisFunctionResult } from '../../src/redis/types';

/**
 * Mock Redis client with all necessary methods for testing
 */
export interface MockRedis extends jest.Mocked<Redis> {
  // Core Redis operations
  del: jest.MockedFunction<Redis['del']>;
  scan: jest.MockedFunction<Redis['scan']>;
  eval: jest.MockedFunction<Redis['eval']>;
  exists: jest.MockedFunction<Redis['exists']>;
  pttl: jest.MockedFunction<Redis['pttl']>;
  
  // ZSET operations
  zadd: jest.MockedFunction<Redis['zadd']>;
  zcard: jest.MockedFunction<Redis['zcard']>;
  zremrangebyscore: jest.MockedFunction<Redis['zremrangebyscore']>;
  zpopmin: jest.MockedFunction<Redis['zpopmin']>;
  
  // String operations
  set: jest.MockedFunction<Redis['set']>;
  get: jest.MockedFunction<Redis['get']>;
  
  // Expiration operations
  pexpire: jest.MockedFunction<Redis['pexpire']>;
}

/**
 * Mock Redis Functions Manager
 */
export interface MockRedisFunctionsManager extends jest.Mocked<RedisFunctionsManager> {
  isLoaded: jest.MockedFunction<() => boolean>;
  executeSlidingWindow: jest.MockedFunction<(keys: string[], args: string[]) => Promise<RedisFunctionResult>>;
  reloadLibrary: jest.MockedFunction<() => Promise<void>>;
}

/**
 * Mock Logger interface
 */
export interface MockLogger extends jest.Mocked<SlidingWindowThrottlerLogger> {
  debug: jest.MockedFunction<(message: string, context?: Record<string, unknown>) => void>;
  info: jest.MockedFunction<(message: string, context?: Record<string, unknown>) => void>;
  warn: jest.MockedFunction<(message: string, context?: Record<string, unknown>) => void>;
  error: jest.MockedFunction<(message: string, error?: Error, context?: Record<string, unknown>) => void>;
}

/**
 * Factory functions for creating type-safe mocks
 */
export class MockFactories {
  /**
   * Create a mock Redis client with sensible defaults
   * 
   * @param overrides - Optional method overrides
   * @returns Mock Redis client
   */
  static createMockRedis(overrides: Partial<MockRedis> = {}): MockRedis {
    const mockRedis = {
      // Core operations
      del: jest.fn().mockResolvedValue(1),
      scan: jest.fn().mockResolvedValue(['0', []]),
      eval: jest.fn().mockResolvedValue([1, 60, 0, -1]),
      exists: jest.fn().mockResolvedValue(0),
      pttl: jest.fn().mockResolvedValue(60000),
      
      // ZSET operations
      zadd: jest.fn().mockResolvedValue(1),
      zcard: jest.fn().mockResolvedValue(1),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zpopmin: jest.fn().mockResolvedValue([]),
      
      // String operations
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      
      // Expiration operations
      pexpire: jest.fn().mockResolvedValue(1),
      
      // Connection status
      status: 'ready',
      
      ...overrides
    } as MockRedis;

    return mockRedis;
  }

  /**
   * Create a mock Redis Functions Manager
   * 
   * @param overrides - Optional method overrides
   * @returns Mock Redis Functions Manager
   */
  static createMockRedisFunctionsManager(overrides: Partial<MockRedisFunctionsManager> = {}): MockRedisFunctionsManager {
    const mockManager = {
      isLoaded: jest.fn().mockReturnValue(true),
      executeSlidingWindow: jest.fn().mockResolvedValue([1, 60, 0, -1]),
      reloadLibrary: jest.fn().mockResolvedValue(undefined),
      
      ...overrides
    } as MockRedisFunctionsManager;

    return mockManager;
  }

  /**
   * Create a mock logger with no-op implementations
   * 
   * @param overrides - Optional method overrides
   * @returns Mock logger
   */
  static createMockLogger(overrides: Partial<MockLogger> = {}): MockLogger {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      
      ...overrides
    } as MockLogger;

    return mockLogger;
  }

  /**
   * Create a test Redis configuration
   * 
   * @param overrides - Optional configuration overrides
   * @returns Redis configuration
   */
  static createRedisConfig(overrides: Partial<RedisConfig> = {}): RedisConfig {
    const defaultConfig: RedisConfig = {
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'test_throttle'
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create a test throttler configuration
   * 
   * @param type - Configuration type ('minimal' or 'full')
   * @param overrides - Optional configuration overrides
   * @returns Throttler configuration
   */
  static createThrottlerConfig(
    type: 'minimal' | 'full' = 'minimal',
    overrides: Partial<ThrottlerConfig> = {}
  ): ThrottlerConfig {
    const baseConfig: ThrottlerConfig = {
      redis: MockFactories.createRedisConfig(),
      throttler: {
        failureStrategy: RedisFailureStrategy.FAIL_OPEN,
        enableDebugLogging: false,
        maxWindowSize: 1000,
        enableRedisFunctions: true
      }
    };

    if (type === 'full') {
      baseConfig.redis.password = 'test_password';
      baseConfig.throttler.keyPrefix = 'full_test';
      baseConfig.throttler.enableDebugLogging = true;
    }

    return {
      redis: { ...baseConfig.redis, ...overrides.redis },
      throttler: { ...baseConfig.throttler, ...overrides.throttler }
    };
  }

  /**
   * Create a mock Key Generator
   * 
   * @param overrides - Optional configuration overrides
   * @returns Key Generator instance
   */
  static createKeyGenerator(overrides: {
    prefix?: string;
    strategy?: KeyGenerationStrategy;
  } = {}): KeyGenerator {
    return new KeyGenerator({
      prefix: 'test_throttle',
      strategy: KeyGenerationStrategy.CLUSTER_SAFE,
      ...overrides
    });
  }

  /**
   * Create mock Redis scan results for testing cleanup operations
   * 
   * @param keys - Keys to return in scan results
   * @returns Mock scan function that returns the specified keys
   */
  static createMockScanResults(keys: string[]): jest.MockedFunction<Redis['scan']> {
    let callCount = 0;
    
    return jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call returns keys and cursor '0' to indicate completion
        return Promise.resolve(['0', keys]);
      }
      // Subsequent calls return empty results
      return Promise.resolve(['0', []]);
    });
  }

  /**
   * Create a mock Redis client that simulates connection failures
   * 
   * @param errorMessage - Error message to throw
   * @returns Mock Redis client that throws connection errors
   */
  static createFailingMockRedis(errorMessage: string = 'Connection failed'): MockRedis {
    const connectionError = new Error(errorMessage);
    
    return MockFactories.createMockRedis({
      del: jest.fn().mockRejectedValue(connectionError),
      scan: jest.fn().mockRejectedValue(connectionError),
      eval: jest.fn().mockRejectedValue(connectionError),
      exists: jest.fn().mockRejectedValue(connectionError),
      pttl: jest.fn().mockRejectedValue(connectionError),
      zadd: jest.fn().mockRejectedValue(connectionError),
      zcard: jest.fn().mockRejectedValue(connectionError),
      zremrangebyscore: jest.fn().mockRejectedValue(connectionError),
      zpopmin: jest.fn().mockRejectedValue(connectionError),
      set: jest.fn().mockRejectedValue(connectionError),
      get: jest.fn().mockRejectedValue(connectionError),
      pexpire: jest.fn().mockRejectedValue(connectionError),
      status: 'disconnected'
    });
  }

  /**
   * Create a mock Redis Functions Manager that simulates function loading failures
   * 
   * @param shouldFailExecution - Whether function execution should fail
   * @returns Mock Redis Functions Manager with failure simulation
   */
  static createFailingMockRedisFunctionsManager(shouldFailExecution: boolean = true): MockRedisFunctionsManager {
    const executionError = new Error('Redis Function execution failed');
    
    return MockFactories.createMockRedisFunctionsManager({
      isLoaded: jest.fn().mockReturnValue(false),
      executeSlidingWindow: shouldFailExecution 
        ? jest.fn().mockRejectedValue(executionError)
        : jest.fn().mockResolvedValue([1, 60, 0, -1]),
      reloadLibrary: jest.fn().mockRejectedValue(new Error('Function reload failed'))
    });
  }
}

/**
 * Utility functions for working with mocks in tests
 */
export class MockUtils {
  /**
   * Reset all mocks in a mock object
   * 
   * @param mockObject - Object containing Jest mocks
   */
  static resetAllMocks(mockObject: Record<string, jest.MockedFunction<unknown>>): void {
    Object.values(mockObject).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset();
      }
    });
  }

  /**
   * Verify that a mock was called with specific arguments
   * 
   * @param mock - Jest mock function
   * @param expectedArgs - Expected arguments
   * @param callIndex - Which call to check (default: 0)
   */
  static expectMockCalledWith<T extends (...args: never[]) => unknown>(
    mock: jest.MockedFunction<T>,
    expectedArgs: Parameters<T>,
    callIndex: number = 0
  ): void {
    expect(mock).toHaveBeenCalledWith(...expectedArgs);
    if (mock.mock.calls.length > callIndex) {
      expect(mock.mock.calls[callIndex]).toEqual(expectedArgs);
    }
  }

  /**
   * Create a mock that returns different values on subsequent calls
   * 
   * @param values - Array of values to return in sequence
   * @returns Mock function that returns values in sequence
   */
  static createSequentialMock<T>(values: T[]): jest.MockedFunction<() => T> {
    let callIndex = 0;
    
    return jest.fn().mockImplementation(() => {
      const value = values[callIndex] || values[values.length - 1];
      callIndex++;
      return value;
    });
  }
}