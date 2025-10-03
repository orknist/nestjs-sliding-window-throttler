// Re-export enums from config module
export { RedisFailureStrategy } from '../config/enums';

// Core interfaces
// Define ThrottlerRecord interface (same structure as @nestjs/throttler's ThrottlerStorageRecord)
export interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Re-export the extended storage interface from storage module
export type { ExtendedThrottlerStorage as ThrottlerStorage } from '../storage/sliding-window-throttler.storage';

// Re-export configuration interfaces from config module
export type { RedisConfig, ThrottlerConfig, ThrottlerOptions } from '../config/interfaces';

// Re-export validation functions from config module
export { isRedisFailureStrategy } from '../config/validation';

export function isThrottlerRecord(value: unknown): value is ThrottlerRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).totalHits === 'number' &&
    typeof (value as Record<string, unknown>).timeToExpire === 'number' &&
    typeof (value as Record<string, unknown>).isBlocked === 'boolean' &&
    typeof (value as Record<string, unknown>).timeToBlockExpire === 'number'
  );
}
