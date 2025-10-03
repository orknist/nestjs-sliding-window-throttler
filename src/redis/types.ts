/**
 * @fileoverview Internal Redis types for nestjs-sliding-window-throttler
 *
 * This module contains internal types used by the Redis implementation.
 * These types are not part of the public API and should not be exported
 * from the main package.
 *
 * @internal
 */

/**
 * Redis key structure for sliding window implementation
 * @internal - This type is not part of the public API
 */
export interface RedisKeys {
  /** ZSET key for storing request timestamps */
  zKey: string;
  /** String key for storing block status */
  blockKey: string;
}

/**
 * Result from Redis Function execution
 * @internal - This type is not part of the public API
 */
export type RedisFunctionResult = [
  /** Current hit count */
  number,
  /** Time to expire in seconds */
  number,
  /** Is blocked (1 for true, 0 for false) */
  number,
  /** Time to block expire in seconds */
  number,
];
