# Type Definitions Documentation

This document provides comprehensive documentation for all TypeScript interfaces, types, and enums provided by the `nestjs-sliding-window-throttler` package.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [Configuration Interfaces](#configuration-interfaces)
- [Enums](#enums)
- [Error Classes](#error-classes)
- [Type Guards](#type-guards)
- [Redis Types](#redis-types)
- [Key Generation Types](#key-generation-types)
- [Storage Types](#storage-types)
- [Usage Examples](#usage-examples)

## Core Interfaces

### ThrottlerStorageRecord

The main interface returned by storage operations, compatible with `@nestjs/throttler`.

```typescript
interface ThrottlerStorageRecord {
  totalHits: number;        // Current hit count in the sliding window
  timeToExpire: number;     // Seconds until window expires
  isBlocked: boolean;       // Whether requests are currently blocked
  timeToBlockExpire: number; // Seconds until block expires (-1 if not blocked)
}
```

**Example:**
```typescript
const record: ThrottlerStorageRecord = {
  totalHits: 5,
  timeToExpire: 55,
  isBlocked: false,
  timeToBlockExpire: -1
};
```

### ThrottlerStorage

Interface that all storage implementations must implement.

```typescript
interface ThrottlerStorage {
  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord>;
  
  reset(key: string): Promise<void>;
}
```

## Configuration Interfaces

### SlidingWindowThrottlerConfig

Main configuration interface for the throttler.

```typescript
interface SlidingWindowThrottlerConfig {
  redis: RedisConfiguration;
  failureStrategy: FailureStrategy;
  enableDebugLogging?: boolean;
  maxWindowSize?: number;
  functionLibraryPrefix?: string;
  enableRedisFunctions?: boolean;
}
```

**Properties:**
- `redis`: Redis connection configuration
- `failureStrategy`: How to handle Redis failures ('fail-open' | 'fail-closed')
- `enableDebugLogging`: Enable debug logging (default: false)
- `maxWindowSize`: Maximum entries in sliding window (default: 1000)
- `functionLibraryPrefix`: Redis Function library prefix (default: 'sliding_window_throttler')
- `enableRedisFunctions`: Use Redis Functions for better performance (default: true)

### RedisConfiguration

Redis connection configuration options.

```typescript
interface RedisConfiguration {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  retryDelayOnFailover?: number;
  tls?: boolean;
}
```

### SlidingWindowThrottlerAsyncConfig

Configuration for dynamic/async module setup.

```typescript
interface SlidingWindowThrottlerAsyncConfig {
  useFactory?: (...args: any[]) => Promise<SlidingWindowThrottlerConfig> | SlidingWindowThrottlerConfig;
  inject?: any[];
  imports?: any[];
  useExisting?: any;
  useClass?: any;
}
```

## Enums

### FailureStrategy

Defines how to handle Redis unavailability.

```typescript
enum FailureStrategy {
  FAIL_OPEN = 'fail-open',   // Allow all requests when Redis is down
  FAIL_CLOSED = 'fail-closed' // Block all requests when Redis is down
}
```

### ThrottlerErrorCode

Error codes for different failure scenarios.

```typescript
enum ThrottlerErrorCode {
  REDIS_CONNECTION_FAILED = 'REDIS_CONNECTION_FAILED',
  REDIS_FUNCTIONS_NOT_SUPPORTED = 'REDIS_FUNCTIONS_NOT_SUPPORTED',
  REDIS_FUNCTIONS_LOAD_FAILED = 'REDIS_FUNCTIONS_LOAD_FAILED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  STORAGE_OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED'
}
```

### LogLevel

Debug logging levels.

```typescript
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}
```

## Error Classes

### ThrottlerError

Base error class for all throttler-related errors.

```typescript
class ThrottlerError extends Error {
  constructor(
    message: string,
    public readonly code: ThrottlerErrorCode,
    public readonly cause?: Error
  );
}
```

### RedisConnectionError

Thrown when Redis connection fails.

```typescript
class RedisConnectionError extends ThrottlerError {
  constructor(message: string, cause?: Error);
}
```

### RedisFunctionsNotSupportedError

Thrown when Redis version doesn't support Functions (< 7.0).

```typescript
class RedisFunctionsNotSupportedError extends ThrottlerError {
  constructor(redisVersion: string);
}
```

### InvalidConfigurationError

Thrown when configuration is invalid.

```typescript
class InvalidConfigurationError extends ThrottlerError {
  constructor(message: string, public readonly field?: string);
}
```

## Type Guards

### isFailureStrategy

Checks if a value is a valid FailureStrategy.

```typescript
function isFailureStrategy(value: any): value is FailureStrategy;
```

**Example:**
```typescript
if (isFailureStrategy(config.failureStrategy)) {
  // TypeScript knows this is a valid FailureStrategy
}
```

### isThrottlerStorageRecord

Validates a ThrottlerStorageRecord structure.

```typescript
function isThrottlerStorageRecord(value: any): value is ThrottlerStorageRecord;
```

### isThrottlerError

Checks if an error is a ThrottlerError.

```typescript
function isThrottlerError(error: any): error is ThrottlerError;
```

## Redis Types

### RedisServerInfo

Information about the Redis server.

```typescript
interface RedisServerInfo {
  version: string;
  functionsSupported: boolean;
  mode: 'standalone' | 'cluster' | 'sentinel';
  connectedClients: number;
  usedMemory: number;
  maxMemory: number;
}
```

### RedisConnectionPoolStats

Connection pool statistics.

```typescript
interface RedisConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalCommands: number;
  failedCommands: number;
  averageResponseTime: number;
}
```

### RedisMonitoringMetrics

Comprehensive Redis monitoring data.

```typescript
interface RedisMonitoringMetrics {
  connectionPool: RedisConnectionPoolStats;
  serverInfo: RedisServerInfo;
  memoryUsage: {
    used: number;
    peak: number;
    fragmentationRatio: number;
  };
  performance: {
    operationsPerSecond: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  lastUpdated: Date;
}
```

## Key Generation Types

### KeyGenerationStrategy

Strategies for generating Redis keys.

```typescript
enum KeyGenerationStrategy {
  SIMPLE = 'simple',           // Simple concatenation
  HASH = 'hash',              // Hash-based generation
  CLUSTER_SAFE = 'cluster-safe' // Cluster-safe with hash tags
}
```

### KeyType

Types of keys used in the implementation.

```typescript
enum KeyType {
  SLIDING_WINDOW = 'z',    // ZSET for sliding window
  BLOCK = 'block',         // String for block status
  METADATA = 'meta',       // Hash for metadata
  SESSIONS = 'sessions'    // Set for active sessions
}
```

### KeyGenerationContext

Context for key generation.

```typescript
interface KeyGenerationContext {
  identifier: string;
  throttlerName: string;
  keyType: KeyType;
  prefix?: string;
  strategy?: KeyGenerationStrategy;
  metadata?: Record<string, string>;
}
```

### GeneratedKey

Result of key generation.

```typescript
interface GeneratedKey {
  key: string;
  components: KeyComponentValue[];
  hashTag?: string;
  strategy: KeyGenerationStrategy;
  estimatedSlot?: number;
}
```

## Storage Types

### StorageOperation

Types of storage operations.

```typescript
enum StorageOperation {
  INCREMENT = 'increment',
  RESET = 'reset',
  GET_STATE = 'get_state',
  CLEANUP = 'cleanup',
  HEALTH_CHECK = 'health_check'
}
```

### StorageBackend

Available storage backends.

```typescript
enum StorageBackend {
  REDIS_SLIDING_WINDOW = 'redis-sliding-window',
  MEMORY = 'memory',
  CUSTOM = 'custom'
}
```

### SlidingWindowConfig

Configuration for sliding window algorithm.

```typescript
interface SlidingWindowConfig {
  windowSize: number;        // Window size in milliseconds
  maxRequests: number;       // Maximum requests in window
  precision: number;         // Precision in milliseconds
  useSubWindows: boolean;    // Use sub-windows for better precision
  subWindowCount?: number;   // Number of sub-windows
  cleanupInterval: number;   // Cleanup interval in milliseconds
}
```

### StorageOperationResult

Result of storage operations.

```typescript
interface StorageOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: StorageError;
  executionTime: number;
  backend: StorageBackend;
  metadata?: Record<string, any>;
}
```

### StorageHealthStatus

Health status of storage backend.

```typescript
interface StorageHealthStatus {
  isHealthy: boolean;
  backend: StorageBackend;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastSuccessfulOperation?: Date;
  lastError?: StorageError;
  performance: {
    averageResponseTime: number;
    operationsPerSecond: number;
    errorRate: number;
  };
  resourceUsage: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}
```

## Usage Examples

### Basic Configuration

```typescript
import { SlidingWindowThrottlerConfig, FailureStrategy } from 'nestjs-sliding-window-throttler';

const config: SlidingWindowThrottlerConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0
  },
  failureStrategy: FailureStrategy.FAIL_OPEN,
  enableDebugLogging: true,
  maxWindowSize: 1000
};
```

### Error Handling

```typescript
import { 
  ThrottlerError, 
  RedisConnectionError, 
  isThrottlerError 
} from 'nestjs-sliding-window-throttler';

try {
  await storage.increment(key, ttl, limit, blockDuration, throttlerName);
} catch (error) {
  if (isThrottlerError(error)) {
    console.error(`Throttler error [${error.code}]: ${error.message}`);
    
    if (error instanceof RedisConnectionError) {
      // Handle Redis connection issues
      console.error('Redis connection failed, falling back to fail-open strategy');
    }
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Type Guards Usage

```typescript
import { 
  isThrottlerStorageRecord, 
  isFailureStrategy 
} from 'nestjs-sliding-window-throttler';

// Validate storage record
const result = await someOperation();
if (isThrottlerStorageRecord(result)) {
  console.log(`Hits: ${result.totalHits}, Blocked: ${result.isBlocked}`);
}

// Validate configuration
const strategy = process.env.FAILURE_STRATEGY;
if (isFailureStrategy(strategy)) {
  config.failureStrategy = strategy;
} else {
  throw new Error(`Invalid failure strategy: ${strategy}`);
}
```

### Async Configuration

```typescript
import { 
  SlidingWindowThrottlerAsyncConfig,
  SlidingWindowThrottlerConfig,
  FailureStrategy 
} from 'nestjs-sliding-window-throttler';

const asyncConfig: SlidingWindowThrottlerAsyncConfig = {
  useFactory: async (configService: ConfigService): Promise<SlidingWindowThrottlerConfig> => ({
    redis: {
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      password: configService.get('REDIS_PASSWORD'),
    },
    failureStrategy: FailureStrategy.FAIL_OPEN,
    enableDebugLogging: configService.get('NODE_ENV') === 'development',
  }),
  inject: [ConfigService],
};
```

## Best Practices

1. **Always use type guards** when working with external data or configuration
2. **Handle errors appropriately** using the provided error classes and type guards
3. **Use the enum values** instead of string literals for better type safety
4. **Leverage TypeScript's type system** to catch configuration errors at compile time
5. **Document your custom implementations** using the provided interfaces as contracts

## Migration Guide

When upgrading from other throttler implementations:

1. Replace your storage interface implementation with `ThrottlerStorage`
2. Update error handling to use the provided error classes
3. Use the configuration interfaces for type-safe setup
4. Leverage type guards for runtime validation
5. Update your tests to use the provided type definitions

This comprehensive type system ensures type safety, better developer experience, and maintainable code throughout your application.