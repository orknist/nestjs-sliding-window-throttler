/**
 * @fileoverview Core test utilities for nestjs-sliding-window-throttler
 *
 * This module provides essential test utilities for Redis cleanup, rate limit scenarios,
 * and common test operations. All utilities are designed to be type-safe and follow
 * professional standards with proper error handling.
 */

import { Redis } from 'ioredis';
import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { ThrottlerRecord, RedisFailureStrategy } from '../../src/core/types';
import { ThrottlerConfig } from '../../src/config';
import { ThrottlerError, ThrottlerErrorCode } from '../../src/core/errors';

/**
 * Rate limit scenario configuration for testing
 */
export interface RateLimitScenario {
  /** Unique identifier for the rate limit */
  key: string;
  /** Name of the throttler */
  throttlerName: string;
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in milliseconds */
  ttl: number;
  /** Number of requests to simulate */
  requestCount: number;
  /** Block duration in milliseconds */
  blockDuration?: number;
}

/**
 * Result of a rate limit scenario test
 */
export interface RateLimitScenarioResult {
  /** Number of requests that were allowed */
  allowedCount: number;
  /** Number of requests that were blocked */
  blockedCount: number;
  /** Final throttler record state */
  finalRecord: ThrottlerRecord;
  /** All individual request results */
  requestResults: ThrottlerRecord[];
}

/**
 * Concurrency test scenario configuration
 */
export interface ConcurrencyScenario {
  /** Number of concurrent users */
  userCount: number;
  /** Number of requests per user */
  requestsPerUser: number;
  /** Rate limit configuration */
  limit: number;
  /** Time window in milliseconds */
  ttl: number;
  /** Block duration in milliseconds */
  blockDuration?: number;
}

/**
 * Core test utilities for the sliding window throttler
 */
export class TestUtils {
  /**
   * Clean Redis keys matching a pattern
   * 
   * @param redis - Redis client instance
   * @param pattern - Key pattern to match (default: 'throttle:*')
   * @returns Promise that resolves when cleanup is complete
   */
  static async cleanRedis(redis: Redis, pattern: string = 'throttle:*'): Promise<void> {
    try {
      const keys = await TestUtils.scanKeys(redis, pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      throw new ThrottlerError(
        `Redis cleanup failed: ${error}`,
        ThrottlerErrorCode.REDIS_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create and execute a rate limit scenario
   * 
   * @param storage - Storage instance to test
   * @param scenario - Rate limit scenario configuration
   * @returns Promise resolving to scenario results
   */
  static async createRateLimitScenario(
    storage: SlidingWindowThrottlerStorage,
    scenario: RateLimitScenario
  ): Promise<RateLimitScenarioResult> {
    const requestResults: ThrottlerRecord[] = [];
    let allowedCount = 0;
    let blockedCount = 0;

    try {
      // Execute requests sequentially to ensure predictable behavior
      for (let i = 0; i < scenario.requestCount; i++) {
        const result = await storage.increment(
          scenario.key,
          scenario.ttl,
          scenario.limit,
          scenario.blockDuration || 0,
          scenario.throttlerName
        );

        requestResults.push(result);

        if (result.isBlocked) {
          blockedCount++;
        } else {
          allowedCount++;
        }
      }

      const finalRecord = requestResults[requestResults.length - 1];

      return {
        allowedCount,
        blockedCount,
        finalRecord,
        requestResults
      };
    } catch (error) {
      throw new ThrottlerError(
        `Rate limit scenario failed: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Execute concurrent requests to test race conditions
   * 
   * @param storage - Storage instance to test
   * @param scenario - Concurrency scenario configuration
   * @returns Promise resolving to aggregated results
   */
  static async createConcurrencyScenario(
    storage: SlidingWindowThrottlerStorage,
    scenario: ConcurrencyScenario
  ): Promise<RateLimitScenarioResult> {
    const allPromises: Promise<ThrottlerRecord>[] = [];

    // Create concurrent requests for each user
    for (let user = 0; user < scenario.userCount; user++) {
      const userKey = `user_${user}`;
      
      for (let request = 0; request < scenario.requestsPerUser; request++) {
        const promise = storage.increment(
          userKey,
          scenario.ttl,
          scenario.limit,
          scenario.blockDuration || 0,
          'concurrency_test'
        );
        allPromises.push(promise);
      }
    }

    try {
      const requestResults = await Promise.all(allPromises);
      
      let allowedCount = 0;
      let blockedCount = 0;

      for (const result of requestResults) {
        if (result.isBlocked) {
          blockedCount++;
        } else {
          allowedCount++;
        }
      }

      const finalRecord = requestResults[requestResults.length - 1];

      return {
        allowedCount,
        blockedCount,
        finalRecord,
        requestResults
      };
    } catch (error) {
      throw new ThrottlerError(
        `Concurrency scenario failed: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Generate a unique test key with optional prefix
   * 
   * @param prefix - Optional prefix for the key
   * @returns Unique test key
   */
  static getTestKey(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Wait for a specified duration
   * 
   * @param ms - Milliseconds to wait
   * @returns Promise that resolves after the specified time
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate that a ThrottlerRecord has expected properties
   * 
   * @param record - Record to validate
   * @returns True if valid, throws error if invalid
   */
  static validateThrottlerRecord(record: ThrottlerRecord): boolean {
    if (typeof record.totalHits !== 'number' || record.totalHits < 0) {
      throw new Error('Invalid totalHits: must be a non-negative number');
    }

    if (typeof record.timeToExpire !== 'number' || record.timeToExpire < 0) {
      throw new Error('Invalid timeToExpire: must be a non-negative number');
    }

    if (typeof record.isBlocked !== 'boolean') {
      throw new Error('Invalid isBlocked: must be a boolean');
    }

    if (typeof record.timeToBlockExpire !== 'number') {
      throw new Error('Invalid timeToBlockExpire: must be a number');
    }

    return true;
  }

  /**
   * Create a test configuration with sensible defaults
   * 
   * @param overrides - Configuration overrides
   * @returns Test configuration
   */
  static createTestConfig(overrides: Partial<ThrottlerConfig> = {}): ThrottlerConfig {
    const defaultConfig: ThrottlerConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: 'test_throttle'
      },
      throttler: {
        failureStrategy: RedisFailureStrategy.FAIL_OPEN,
        enableDebugLogging: false,
        maxWindowSize: 1000,
        enableRedisFunctions: true
      }
    };

    return {
      redis: { ...defaultConfig.redis, ...overrides.redis },
      throttler: { ...defaultConfig.throttler, ...overrides.throttler }
    };
  }

  /**
   * Scan Redis keys matching a pattern
   * 
   * @param redis - Redis client
   * @param pattern - Pattern to match
   * @returns Array of matching keys
   */
  private static async scanKeys(redis: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of an async operation
   * 
   * @param operation - Async operation to measure
   * @returns Promise resolving to result and execution time
   */
  static async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    
    return { result, duration };
  }

  /**
   * Execute operations in batches to avoid overwhelming the system
   * 
   * @param operations - Array of operations to execute
   * @param batchSize - Number of operations per batch
   * @param delayBetweenBatches - Delay between batches in milliseconds
   * @returns Promise resolving to all results
   */
  static async executeBatched<T>(
    operations: (() => Promise<T>)[],
    batchSize: number = 10,
    delayBetweenBatches: number = 100
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
      
      // Add delay between batches if not the last batch
      if (i + batchSize < operations.length) {
        await TestUtils.wait(delayBetweenBatches);
      }
    }
    
    return results;
  }
}