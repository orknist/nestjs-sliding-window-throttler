// Core interfaces and types
export type { ThrottlerStorage, ThrottlerRecord } from './core/types';
export type { ThrottlerConfig, RedisConfig, ThrottlerOptions } from './config';
export { RedisFailureStrategy } from './config';

// Logger interfaces
export type { SlidingWindowThrottlerLogger, SlidingWindowThrottlerLoggerFactory } from './core';
export { SlidingWindowThrottlerConsoleLogger, SlidingWindowThrottlerConsoleLoggerFactory } from './core';

// Error handling
export { ThrottlerError, ThrottlerRedisConnectionError, ThrottlerConfigurationError } from './core/errors';
export { ThrottlerErrorCode } from './core/errors';
export { isThrottlerError, isThrottlerRedisConnectionError, isThrottlerConfigurationError } from './core/errors';

// Core implementation
export { SlidingWindowThrottlerStorage } from './storage';
export { SlidingWindowThrottlerModule } from './module';
export type { SlidingWindowThrottlerAsyncConfig } from './module';

// Configuration utilities
export { createConfig, getConfigSummary, validateConfig } from './config';

// Type guards
export { isRedisFailureStrategy } from './config';
export { isThrottlerRecord } from './core/types';
