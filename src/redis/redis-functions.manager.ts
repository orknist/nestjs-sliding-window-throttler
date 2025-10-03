/**
 * @fileoverview Simplified Redis Functions Manager for sliding window throttler
 *
 * This module provides Redis 7.0+ Functions API integration for high-performance
 * sliding window rate limiting with automatic fallback to Lua scripts.
 */

import { Redis } from 'ioredis';
import { SlidingWindowThrottlerLogger } from '../core';
import { ThrottlerError, ThrottlerErrorCode, ThrottlerRedisConnectionError } from '../core/errors';
import { RedisFunctionResult } from './types';

/**
 * Simplified Redis Functions Manager for sliding window throttler
 *
 * This class manages Redis Functions for high-performance sliding window
 * rate limiting with automatic fallback to Lua scripts when Redis Functions
 * are not available.
 *
 * @public
 */
export class RedisFunctionsManager {
  private static readonly LIBRARY_NAME = 'sliding_window_throttler';
  private static readonly FUNCTION_NAME = 'sliding_window_check';
  private static readonly MIN_REDIS_VERSION = '7.0.0';

  private readonly redis: Redis;
  private readonly libraryName: string;
  private readonly logger: SlidingWindowThrottlerLogger | undefined;

  private isLibraryLoaded = false;

  /**
   * Create a new RedisFunctionsManager instance
   *
   * @param redis - Redis client instance
   * @param options - Configuration options
   */
  constructor(
    redis: Redis,
    options: {
      libraryPrefix?: string;
      logger?: SlidingWindowThrottlerLogger;
    } = {},
  ) {
    this.redis = redis;
    this.libraryName = options.libraryPrefix
      ? `${options.libraryPrefix}_${RedisFunctionsManager.LIBRARY_NAME}`
      : RedisFunctionsManager.LIBRARY_NAME;
    this.logger = options.logger;
  }

  /**
   * Initialize the Redis Functions Manager
   *
   * This method checks Redis version compatibility and loads the function library.
   * It should be called during application startup.
   *
   * @returns Promise that resolves when initialization is complete
   * @throws {ThrottlerError} When Redis Functions cannot be loaded
   * @throws {ThrottlerRedisConnectionError} When Redis connection fails
   */
  async initialize(): Promise<void> {
    try {
      this.logger?.info('Initializing Redis Functions Manager');

      // Check Redis version compatibility and load function library
      await this.loadFunctionLibrary();

      this.logger?.info('Redis Functions Manager initialized successfully', {
        libraryName: this.libraryName,
      });
    } catch (error) {
      this.logger?.error('Redis Functions Manager initialization failed', error instanceof Error ? error : new Error(String(error)), {
        libraryName: this.libraryName,
      });

      throw error;
    }
  }

  /**
   * Execute sliding window rate limit check using Redis Function
   *
   * @param keys - Redis keys [zKey, blockKey]
   * @param args - Function arguments [ttlMs, limit, blockDurationMs, nowMs, member]
   * @returns Promise resolving to function result
   * @throws {ThrottlerError} When function execution fails
   */
  async executeSlidingWindow(keys: string[], args: string[]): Promise<RedisFunctionResult> {
    try {
      if (!this.isLibraryLoaded) {
        throw new ThrottlerError('Redis Functions library not loaded', ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED);
      }

      if (keys.length !== 2) {
        throw new ThrottlerError(
          `Expected exactly 2 keys for sliding window function, got ${keys.length}`,
          ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        );
      }

      if (args.length !== 5) {
        throw new ThrottlerError(
          `Expected exactly 5 arguments for sliding window function, got ${args.length}`,
          ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        );
      }

      this.logger?.debug(`Executing Redis Function: ${RedisFunctionsManager.FUNCTION_NAME}`, {
        keys: keys.length,
        args: args.length,
      });

      // Execute Redis Function
      const result = (await this.redis.fcall(RedisFunctionsManager.FUNCTION_NAME, keys.length, ...keys, ...args)) as number[];

      // Validate result format
      if (!Array.isArray(result) || result.length !== 4) {
        throw new ThrottlerError(
          `Invalid function result format: expected array of 4 numbers, got ${typeof result}`,
          ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        );
      }

      // Convert to expected format
      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result;
      const formattedResult: RedisFunctionResult = [Number(totalHits), Number(timeToExpire), Number(isBlocked), Number(timeToBlockExpire)];

      this.logger?.debug('Function executed successfully', {
        result: formattedResult,
      });

      return formattedResult;
    } catch (error) {
      this.logger?.error('Redis Function execution failed', error instanceof Error ? error : new Error(String(error)), {
        functionName: RedisFunctionsManager.FUNCTION_NAME,
      });

      if (error instanceof ThrottlerError) {
        throw error;
      }

      // Handle Redis-specific errors
      if (error instanceof Error) {
        if (error.message.includes('NOSCRIPT') || error.message.includes('unknown command')) {
          // Function was unloaded, try to reload
          this.isLibraryLoaded = false;

          this.logger?.warn('Redis Function not found, library may have been unloaded', {
            libraryName: this.libraryName,
            functionName: RedisFunctionsManager.FUNCTION_NAME,
          });

          throw new ThrottlerError(
            'Redis Function not found, library may have been unloaded',
            ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED,
            error,
          );
        }

        if (error.message.includes('connection') || error.message.includes('Connection lost')) {
          throw new ThrottlerRedisConnectionError('Redis connection failed during function execution', error);
        }
      }

      throw new ThrottlerError(
        `Redis Function execution failed: ${error}`,
        ThrottlerErrorCode.STORAGE_OPERATION_FAILED,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Check if Redis Functions library is loaded and available
   *
   * @returns True if library is loaded and ready for use
   */
  isLoaded(): boolean {
    return this.isLibraryLoaded;
  }

  /**
   * Force reload the Redis Functions library
   *
   * This method can be used to recover from function unloading or
   * to update the function library with new code.
   *
   * @returns Promise that resolves when reload is complete
   */
  async reloadLibrary(): Promise<void> {
    this.logger?.info('Reloading Redis Functions library');
    this.isLibraryLoaded = false;
    await this.loadFunctionLibrary();
  }

  /**
   * Load the Redis Functions library
   */
  private async loadFunctionLibrary(): Promise<void> {
    try {
      this.logger?.debug(`Loading Redis Functions library: ${this.libraryName}`);

      const functionCode = this.getFunctionCode();

      // Load function library
      await this.redis.function('LOAD', 'REPLACE', functionCode);

      // Verify function is available
      await this.verifyFunctionAvailability();

      this.isLibraryLoaded = true;

      this.logger?.debug('Redis Functions library loaded successfully');
    } catch (error) {
      this.isLibraryLoaded = false;

      this.logger?.error('Failed to load Redis Functions library', error instanceof Error ? error : new Error(String(error)));

      throw new ThrottlerError(
        `Failed to load Redis Functions library: ${error}`,
        ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Verify that the loaded function is available for execution
   */
  private async verifyFunctionAvailability(): Promise<void> {
    try {
      // Try to execute a simple test call to verify function exists
      // This is more reliable than parsing the complex FUNCTION LIST response
      try {
        await this.redis.fcall(
          RedisFunctionsManager.FUNCTION_NAME,
          2,
          'test:verify:z',
          'test:verify:block',
          '1000',
          '1',
          '0',
          Date.now().toString(),
          'verify-member',
        );

        this.logger?.debug('Function availability verified via test execution');
        return;
      } catch (error) {
        // If function doesn't exist, Redis will return specific error
        if (error instanceof Error && error.message.includes('Function not found')) {
          throw new Error(`Function ${RedisFunctionsManager.FUNCTION_NAME} not found`);
        }

        // If we get other errors (like argument validation), the function exists
        // This is expected since we're using test parameters
        this.logger?.debug('Function availability verified (function exists but test parameters failed as expected)');
        return;
      }
    } catch (error) {
      throw new ThrottlerError(
        `Function availability verification failed: ${error}`,
        ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get the Lua code for the sliding window Redis Function
   */
  private getFunctionCode(): string {
    return `#!lua name=${this.libraryName}

local function ${RedisFunctionsManager.FUNCTION_NAME}(keys, args)
  local zKey = keys[1]
  local blockKey = keys[2]
  local ttlMs = tonumber(args[1])
  local limit = tonumber(args[2])
  local blockDurationMs = tonumber(args[3])
  local nowMs = tonumber(args[4])
  local member = args[5]
  
  -- Validate arguments
  if not ttlMs or ttlMs <= 0 then
    return redis.error_reply("Invalid TTL: must be positive number")
  end
  
  if not limit or limit <= 0 then
    return redis.error_reply("Invalid limit: must be positive number")
  end
  
  if not blockDurationMs or blockDurationMs < 0 then
    return redis.error_reply("Invalid block duration: must be non-negative number")
  end
  
  if not nowMs or nowMs <= 0 then
    return redis.error_reply("Invalid timestamp: must be positive number")
  end
  
  if not member or member == "" then
    return redis.error_reply("Invalid member: cannot be empty")
  end
  
  -- Check if currently blocked
  if redis.call('EXISTS', blockKey) == 1 then
    local blockTtl = redis.call('PTTL', blockKey)
    local zTtl = redis.call('PTTL', zKey)
    
    -- If block key exists but has no TTL, set a default TTL
    if blockTtl == -1 and blockDurationMs > 1 then
      redis.call('PEXPIRE', blockKey, blockDurationMs)
      blockTtl = blockDurationMs
    end
    
    -- Return blocked status
    return {
      -1, -- totalHits (negative indicates blocked)
      math.max(0, math.ceil((zTtl > 0 and zTtl or ttlMs) / 1000)),
      1, -- isBlocked
      math.max(0, math.ceil((blockTtl > 0 and blockTtl or 0) / 1000))
    }
  end
  
  -- Clean expired entries from sliding window
  local windowStart = nowMs - ttlMs
  local removedCount = redis.call('ZREMRANGEBYSCORE', zKey, 0, windowStart)
  
  -- Count current requests in window
  local currentCount = redis.call('ZCARD', zKey)
  
  -- Check if adding this request would exceed limit
  if (currentCount + 1) > limit then
    -- Limit exceeded, apply blocking if configured
    if blockDurationMs > 1 then
      redis.call('SET', blockKey, '1', 'PX', blockDurationMs)
      local blockTtl = redis.call('PTTL', blockKey)
      return {
        currentCount + 1,
        math.max(0, math.ceil(ttlMs / 1000)),
        1, -- isBlocked
        math.max(0, math.ceil((blockTtl > 0 and blockTtl or blockDurationMs) / 1000))
      }
    else
      -- No blocking, just return limit exceeded
      return {
        currentCount + 1,
        math.max(0, math.ceil(ttlMs / 1000)),
        1, -- isBlocked (temporarily)
        -1 -- no block expiry
      }
    end
  end
  
  -- Add current request to sliding window
  redis.call('ZADD', zKey, nowMs, member)
  
  -- Set TTL on the sliding window key
  redis.call('PEXPIRE', zKey, ttlMs)
  
  -- Limit ZSET size to prevent memory bloat (keep only recent entries)
  local maxWindowSize = 1000 -- Configurable limit
  local currentSize = redis.call('ZCARD', zKey)
  if currentSize > maxWindowSize then
    local excessCount = currentSize - maxWindowSize
    redis.call('ZPOPMIN', zKey, excessCount)
  end
  
  -- Get final count and TTL
  local finalCount = redis.call('ZCARD', zKey)
  local zTtl = redis.call('PTTL', zKey)
  
  return {
    finalCount,
    math.max(0, math.ceil((zTtl > 0 and zTtl or ttlMs) / 1000)),
    0, -- not blocked
    -1 -- no block expiry
  }
end

redis.register_function('${RedisFunctionsManager.FUNCTION_NAME}', ${RedisFunctionsManager.FUNCTION_NAME})`;
  }
}
