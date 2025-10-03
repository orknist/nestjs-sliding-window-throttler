/**
 * @fileoverview Sliding Window Throttler Storage Implementation
 *
 * This module provides the main storage class that implements the ThrottlerStorage
 * interface from @nestjs/throttler. It uses Redis Functions for high-performance
 * sliding window rate limiting with comprehensive error handling and logging.
 */

import { Redis } from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisFailureStrategy, ThrottlerRecord } from '../core/types';
import { ThrottlerConfig } from '../config';
import { KeyGenerator, SlidingWindowThrottlerLogger } from '../core';
import { RedisFunctionsManager } from '../redis';
import { RedisFunctionResult } from '../redis/types';
import { ThrottlerError, ThrottlerErrorCode, ThrottlerRedisConnectionError, ThrottlerConfigurationError } from '../core/errors';

/**
 * Extended interface that includes both NestJS throttler requirements and our additional methods
 */
export interface ExtendedThrottlerStorage extends ThrottlerStorage {
  reset(key: string): Promise<void>;
}

/**
 * Sliding window throttler storage using Redis Functions
 */
export class SlidingWindowThrottlerStorage implements ExtendedThrottlerStorage {
  private readonly redis: Redis;
  private readonly config: ThrottlerConfig;
  private readonly functionsManager: RedisFunctionsManager;
  private readonly keyGenerator: KeyGenerator;
  private readonly logger: SlidingWindowThrottlerLogger | undefined;

  constructor(
    redis: Redis,
    config: ThrottlerConfig,
    functionsManager: RedisFunctionsManager,
    keyGenerator: KeyGenerator,
    logger?: SlidingWindowThrottlerLogger,
  ) {
    this.redis = redis;
    this.config = config;
    this.functionsManager = functionsManager;
    this.keyGenerator = keyGenerator;
    this.logger = logger;

    this.logger?.info('SlidingWindowThrottlerStorage initialized', {
      failureStrategy: config.throttler.failureStrategy,
      maxWindowSize: config.throttler.maxWindowSize,
      enableRedisFunctions: config.throttler.enableRedisFunctions,
    });
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerRecord> {
    const startTime = Date.now();
    this.validateIncrementParameters(key, ttl, limit, blockDuration, throttlerName);

    try {
      this.logIncrementStart(key, ttl, limit, blockDuration, throttlerName);

      const { zKey, blockKey } = this.keyGenerator.generateKeys(key, throttlerName);
      const result = await this.executeIncrementOperation(zKey, blockKey, ttl, limit, blockDuration, key);

      this.logIncrementResult(result, key, throttlerName, limit, startTime);

      return result;
    } catch (error) {
      return this.handleIncrementError(error, key, throttlerName, ttl, blockDuration);
    }
  }

  /**
   * Reset the rate limit data for a given key
   *
   * This method removes all rate limiting data for the specified key,
   * effectively resetting the sliding window and any block status.
   *
   * @param key - Unique identifier for the rate limit to reset
   * @returns Promise that resolves when the reset is complete
   */
  async reset(key: string): Promise<void> {
    try {
      this.logger?.debug('Reset operation started', {
        key: this.maskKey(key),
      });

      if (!key || typeof key !== 'string') {
        throw new ThrottlerConfigurationError('Invalid key: must be a non-empty string', 'key');
      }

      // Generate all possible keys for this identifier
      // Since we don't know the throttler name, we need to use a pattern
      const keyPattern = this.keyGenerator.generateKeys(key, '*');

      // Use Redis SCAN to find all matching keys
      const keysToDelete: string[] = [];

      // Scan for ZSET keys (sliding window data)
      const zKeyPattern = keyPattern.zKey.replace('*', '*');
      const zKeys = await this.scanKeys(zKeyPattern);
      keysToDelete.push(...zKeys);

      // Scan for block keys
      const blockKeyPattern = keyPattern.blockKey.replace('*', '*');
      const blockKeys = await this.scanKeys(blockKeyPattern);
      keysToDelete.push(...blockKeys);

      // Delete all found keys
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
        this.logger?.debug('Reset completed', {
          key: this.maskKey(key),
          deletedKeys: keysToDelete.length,
        });
      } else {
        this.logger?.debug('Reset completed - no keys found', {
          key: this.maskKey(key),
        });
      }
    } catch (error) {
      this.logger?.error('Reset operation failed', error instanceof Error ? error : new Error(String(error)), {
        key: this.maskKey(key),
      });

      // Handle Redis failures based on failure strategy
      if (this.isThrottlerRedisConnectionError(error)) {
        // For reset operations, we can safely ignore Redis failures
        // as the operation is not critical for rate limiting
        this.logger?.debug('Reset operation ignored due to Redis failure', {
          key: this.maskKey(key),
          failureStrategy: this.config.throttler.failureStrategy,
        });
        return;
      }

      // Re-throw other errors
      if (error instanceof ThrottlerError) {
        throw error;
      }

      throw new ThrottlerError(
        `Reset operation failed: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Increment using Redis Functions for optimal performance
   */
  private async incrementWithRedisFunction(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerRecord> {
    const { keys, args } = this.prepareRedisFunctionParameters(zKey, blockKey, ttl, limit, blockDuration);

    try {
      const result: RedisFunctionResult = await this.functionsManager.executeSlidingWindow(keys, args);
      return this.parseRedisFunctionResult(result);
    } catch (error) {
      return this.handleRedisFunctionError(error, zKey, blockKey, ttl, limit, blockDuration);
    }
  }

  /**
   * Prepare parameters for Redis Function execution
   */
  private prepareRedisFunctionParameters(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): { keys: string[]; args: string[] } {
    const nowMs = Date.now();
    const member = this.keyGenerator.generateMember(nowMs);

    return {
      keys: [zKey, blockKey],
      args: [ttl.toString(), limit.toString(), blockDuration.toString(), nowMs.toString(), member],
    };
  }

  /**
   * Handle Redis Function execution errors with retry logic
   */
  private async handleRedisFunctionError(
    error: unknown,
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerRecord> {
    if (error instanceof ThrottlerError && error.code === ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED) {
      return this.retryRedisFunctionWithReload(zKey, blockKey, ttl, limit, blockDuration);
    }

    throw error;
  }

  /**
   * Retry Redis Function execution after reloading the library
   */
  private async retryRedisFunctionWithReload(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerRecord> {
    this.logger?.warn('Redis Function failed, attempting reload');

    try {
      await this.functionsManager.reloadLibrary();
      const { keys, args } = this.prepareRedisFunctionParameters(zKey, blockKey, ttl, limit, blockDuration);
      const retryResult: RedisFunctionResult = await this.functionsManager.executeSlidingWindow(keys, args);
      return this.parseRedisFunctionResult(retryResult);
    } catch {
      this.logger?.warn('Redis Function retry failed, falling back to Lua script');
      return this.incrementWithLuaScript(zKey, blockKey, ttl, limit, blockDuration);
    }
  }

  /**
   * Increment using Lua script as fallback
   */
  private async incrementWithLuaScript(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerRecord> {
    const nowMs = Date.now();
    const member = this.keyGenerator.generateMember(nowMs);
    const maxWindowSize = this.config.throttler.maxWindowSize || 1000;

    const luaScript = `
      local zKey = KEYS[1]
      local blockKey = KEYS[2]
      local ttlMs = tonumber(ARGV[1])
      local limit = tonumber(ARGV[2])
      local blockDurationMs = tonumber(ARGV[3])
      local nowMs = tonumber(ARGV[4])
      local member = ARGV[5]
      
      -- Check if currently blocked
      if redis.call('EXISTS', blockKey) == 1 then
        local blockTtl = redis.call('PTTL', blockKey)
        local zTtl = redis.call('PTTL', zKey)
        return {
          -1,
          math.max(0, math.ceil((zTtl > 0 and zTtl or ttlMs) / 1000)),
          1,
          math.max(0, math.ceil((blockTtl > 0 and blockTtl or 0) / 1000))
        }
      end
      
      -- Clean expired entries
      local windowStart = nowMs - ttlMs
      redis.call('ZREMRANGEBYSCORE', zKey, 0, windowStart)
      
      -- Count current requests
      local currentCount = redis.call('ZCARD', zKey)
      
      -- Check if would exceed limit
      if (currentCount + 1) > limit then
        if blockDurationMs > 1 then
          redis.call('SET', blockKey, '1', 'PX', blockDurationMs)
          local blockTtl = redis.call('PTTL', blockKey)
          return {
            currentCount + 1,
            math.max(0, math.ceil(ttlMs / 1000)),
            1,
            math.max(0, math.ceil((blockTtl > 0 and blockTtl or blockDurationMs) / 1000))
          }
        else
          return {
            currentCount + 1,
            math.max(0, math.ceil(ttlMs / 1000)),
            1,
            -1
          }
        end
      end
      
      -- Add request and set TTL
      redis.call('ZADD', zKey, nowMs, member)
      redis.call('PEXPIRE', zKey, ttlMs)
      
      -- Limit ZSET size to prevent memory bloat
      local maxWindowSize = ${maxWindowSize}
      local currentSize = redis.call('ZCARD', zKey)
      if currentSize > maxWindowSize then
        local excessCount = currentSize - maxWindowSize
        redis.call('ZPOPMIN', zKey, excessCount)
      end
      
      local finalCount = redis.call('ZCARD', zKey)
      local zTtl = redis.call('PTTL', zKey)
      
      return {
        finalCount,
        math.max(0, math.ceil((zTtl > 0 and zTtl or ttlMs) / 1000)),
        0,
        -1
      }
    `;

    const result = (await this.redis.eval(
      luaScript,
      2,
      zKey,
      blockKey,
      ttl.toString(),
      limit.toString(),
      blockDuration.toString(),
      nowMs.toString(),
      member,
    )) as number[];

    return this.parseRedisFunctionResult(result as RedisFunctionResult);
  }

  /**
   * Parse Redis Function result into ThrottlerRecord
   */
  private parseRedisFunctionResult(result: RedisFunctionResult): ThrottlerRecord {
    const [totalHits, timeToExpire, isBlockedNum, timeToBlockExpire] = result;

    return {
      totalHits: Math.max(0, totalHits), // Ensure non-negative
      timeToExpire: Math.max(0, timeToExpire),
      isBlocked: isBlockedNum === 1,
      timeToBlockExpire: timeToBlockExpire >= 0 ? timeToBlockExpire : -1,
    };
  }

  /**
   * Handle Redis connection failures based on failure strategy
   */
  private handleRedisFailure(error: unknown, operation: string): ThrottlerRecord {
    this.logger?.warn(`Redis failure during ${operation}`, {
      error: error instanceof Error ? error.message : String(error),
      failureStrategy: this.config.throttler.failureStrategy,
    });

    if (this.config.throttler.failureStrategy === RedisFailureStrategy.FAIL_OPEN) {
      // Allow requests when Redis is unavailable
      return {
        totalHits: 1,
        timeToExpire: 60, // Default 1 minute
        isBlocked: false,
        timeToBlockExpire: -1,
      };
    } else {
      // Block requests when Redis is unavailable
      return {
        totalHits: 999999, // High number to indicate blocked
        timeToExpire: 60,
        isBlocked: true,
        timeToBlockExpire: 60, // Block for 1 minute
      };
    }
  }

  /**
   * Validate increment method parameters (essential checks only)
   */
  private validateIncrementParameters(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): void {
    // Basic parameter validation
    if (!key || typeof key !== 'string') {
      throw new ThrottlerConfigurationError('Invalid key: must be a non-empty string', 'key');
    }

    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new ThrottlerConfigurationError('Invalid TTL: must be a positive integer', 'ttl');
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new ThrottlerConfigurationError('Invalid limit: must be a positive integer', 'limit');
    }

    if (!Number.isInteger(blockDuration) || blockDuration < 0) {
      throw new ThrottlerConfigurationError('Invalid block duration: must be a non-negative integer', 'blockDuration');
    }

    if (!throttlerName || typeof throttlerName !== 'string') {
      throw new ThrottlerConfigurationError('Invalid throttler name: must be a non-empty string', 'throttlerName');
    }
  }

  /**
   * Check if an error is a Redis connection error
   */
  private isThrottlerRedisConnectionError(error: unknown): boolean {
    if (error instanceof ThrottlerRedisConnectionError) {
      return true;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('connection') ||
        message.includes('connect econnrefused') ||
        message.includes('redis') ||
        message.includes('timeout') ||
        message.includes('network')
      );
    }

    return false;
  }

  /**
   * Scan for Redis keys matching a pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Log the start of an increment operation
   */
  private logIncrementStart(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): void {
    this.logger?.debug('Increment operation started', {
      key: this.maskKey(key),
      ttl,
      limit,
      blockDuration,
      throttlerName,
    });
  }

  /**
   * Execute the core increment operation with Redis Functions or Lua script fallback
   */
  private async executeIncrementOperation(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    originalKey: string,
  ): Promise<ThrottlerRecord> {
    if (this.shouldUseRedisFunction()) {
      return this.executeWithRedisFunctionFallback(zKey, blockKey, ttl, limit, blockDuration, originalKey);
    } else {
      const result = await this.incrementWithLuaScript(zKey, blockKey, ttl, limit, blockDuration);
      this.logger?.debug('Increment completed with Lua script', {
        key: this.maskKey(originalKey),
        result,
      });
      return result;
    }
  }

  /**
   * Determine if Redis Functions should be used
   */
  private shouldUseRedisFunction(): boolean {
    return this.config.throttler.enableRedisFunctions !== false && this.functionsManager.isLoaded();
  }

  /**
   * Execute with Redis Function and fallback to Lua script on failure
   */
  private async executeWithRedisFunctionFallback(
    zKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    originalKey: string,
  ): Promise<ThrottlerRecord> {
    try {
      const result = await this.incrementWithRedisFunction(zKey, blockKey, ttl, limit, blockDuration);
      this.logger?.debug('Increment completed with Redis Function', {
        key: this.maskKey(originalKey),
        result,
      });
      return result;
    } catch (functionError) {
      this.logger?.warn('Redis Function failed, falling back to Lua script', {
        error: functionError instanceof Error ? functionError.message : String(functionError),
      });
      return this.incrementWithLuaScript(zKey, blockKey, ttl, limit, blockDuration);
    }
  }

  /**
   * Log the result of an increment operation
   */
  private logIncrementResult(result: ThrottlerRecord, key: string, throttlerName: string, limit: number, startTime: number): void {
    if (result.isBlocked) {
      this.logger?.warn('Rate limit exceeded', {
        throttlerName,
        key: this.maskKey(key),
        limit,
        current: result.totalHits,
      });
    }

    if (this.config.throttler.enableDebugLogging) {
      const duration = Date.now() - startTime;
      this.logger?.debug('Increment operation completed', {
        duration: `${duration}ms`,
        blocked: result.isBlocked,
      });
    }
  }

  /**
   * Handle errors during increment operation
   */
  private handleIncrementError(error: unknown, key: string, throttlerName: string, ttl: number, blockDuration: number): ThrottlerRecord {
    this.logger?.error('Increment operation failed', error instanceof Error ? error : new Error(String(error)), {
      key: this.maskKey(key),
      throttlerName,
    });

    if (this.isThrottlerRedisConnectionError(error)) {
      return this.applyFailureStrategy(error, key, throttlerName, ttl, blockDuration);
    }

    throw error instanceof ThrottlerError
      ? error
      : new ThrottlerError(
          `Increment operation failed: ${error}`,
          ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
          error instanceof Error ? error : new Error(String(error)),
        );
  }

  /**
   * Apply failure strategy for Redis connection errors
   */
  private applyFailureStrategy(error: unknown, key: string, throttlerName: string, ttl: number, blockDuration: number): ThrottlerRecord {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (this.config.throttler.failureStrategy === RedisFailureStrategy.FAIL_OPEN) {
      this.logger?.warn('Applying fail-open strategy due to Redis connection error', {
        error: errorMessage,
        key: this.maskKey(key),
        throttlerName,
      });

      return {
        isBlocked: false,
        totalHits: 1,
        timeToExpire: ttl,
        timeToBlockExpire: 0,
      };
    } else {
      this.logger?.warn('Applying fail-closed strategy due to Redis connection error', {
        error: errorMessage,
        key: this.maskKey(key),
        throttlerName,
      });

      return {
        isBlocked: true,
        totalHits: 999999,
        timeToExpire: ttl,
        timeToBlockExpire: blockDuration || ttl,
      };
    }
  }

  /**
   * Mask sensitive parts of keys for logging
   */
  private maskKey(key: string): string {
    if (!key || typeof key !== 'string') {
      return '[INVALID_KEY]';
    }
    if (key.length <= 8) {
      return '*'.repeat(key.length);
    }
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  }
}
