# API Documentation

This document provides comprehensive API documentation for the `nestjs-sliding-window-throttler` package, generated from TypeScript definitions and JSDoc comments.

## Table of Contents

- [Classes](#classes)
- [Interfaces](#interfaces)
- [Enums](#enums)
- [Functions](#functions)
- [Type Aliases](#type-aliases)
- [Constants](#constants)

## Classes

### SlidingWindowThrottlerStorage

Main storage implementation for sliding window rate limiting.

```typescript
class SlidingWindowThrottlerStorage implements ThrottlerStorage
```

#### Constructor

```typescript
constructor(
  redis: Redis,
  config: SlidingWindowThrottlerConfig,
  functionsManager: RedisFunctionsManager,
  keyGenerator: KeyGenerator
)
```

**Parameters:**
- `redis` - Redis client instance
- `config` - Throttler configuration
- `functionsManager` - Redis Functions manager
- `keyGenerator` - Key generation utility

#### Methods

##### increment

Increments the request count for a given key and returns throttling information.

```typescript
async increment(
  key: string,
  ttl: number,
  limit: number,
  blockDuration: number,
  throttlerName: string
): Promise<ThrottlerStorageRecord>
```

**Parameters:**
- `key` - Unique identifier for the rate limit (e.g., user ID, IP address)
- `ttl` - Time-to-live for the sliding window in milliseconds
- `limit` - Maximum number of requests allowed in the window
- `blockDuration` - Duration to block requests after limit exceeded (0 = no blocking)
- `throttlerName` - Name of the throttler configuration

**Returns:** Promise resolving to throttling information

**Example:**
```typescript
const result = await storage.increment('user:123', 60000, 10, 30000, 'api-throttler');
console.log(`Hits: ${result.totalHits}, Blocked: ${result.isBlocked}`);
```

##### reset

Resets the rate limit data for a given key.

```typescript
async reset(key: string): Promise<void>
```

**Parameters:**
- `key` - Key to reset

**Example:**
```typescript
await storage.reset('user:123');
```

##### getMetrics

Returns comprehensive metrics about the storage performance and health.

```typescript
async getMetrics(): Promise<StorageMetrics>
```

**Returns:** Promise resolving to storage metrics

**Example:**
```typescript
const metrics = await storage.getMetrics();
console.log('Health:', metrics.health);
console.log('Performance:', metrics.performance);
```

### SlidingWindowThrottlerModule

NestJS module for configuring the sliding window throttler.

```typescript
class SlidingWindowThrottlerModule
```

#### Static Methods

##### forRoot

Configures the module with static configuration.

```typescript
static forRoot(config?: SlidingWindowThrottlerConfig): DynamicModule
```

**Parameters:**
- `config` - Optional configuration object (reads from environment if not provided)

**Returns:** Dynamic module configuration

**Example:**
```typescript
SlidingWindowThrottlerModule.forRoot({
  redis: { host: 'localhost', port: 6379 },
  failureStrategy: 'fail-open'
})
```

##### forRootAsync

Configures the module with dynamic configuration.

```typescript
static forRootAsync(options: SlidingWindowThrottlerAsyncConfig): DynamicModule
```

**Parameters:**
- `options` - Async configuration options

**Returns:** Dynamic module configuration

**Example:**
```typescript
SlidingWindowThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: { host: config.get('REDIS_HOST') }
  })
})
```

### RedisFunctionsManager

Manages Redis Functions for optimal performance.

```typescript
class RedisFunctionsManager
```

#### Constructor

```typescript
constructor(redis: Redis, config: SlidingWindowThrottlerConfig)
```

#### Methods

##### loadFunctions

Loads Redis Functions into Redis memory.

```typescript
async loadFunctions(): Promise<void>
```

**Throws:** `RedisFunctionsLoadError` if loading fails

##### executeSlidingWindow

Executes the sliding window algorithm using Redis Functions.

```typescript
async executeSlidingWindow(
  keys: string[],
  args: string[]
): Promise<[number, number, number, number]>
```

**Parameters:**
- `keys` - Redis keys for the operation
- `args` - Arguments for the function

**Returns:** Tuple of [totalHits, timeToExpire, isBlocked, timeToBlockExpire]

##### isLoaded

Checks if Redis Functions are loaded and available.

```typescript
isLoaded(): boolean
```

**Returns:** True if functions are loaded

### KeyGenerator

Generates Redis keys with cluster compatibility.

```typescript
class KeyGenerator
```

#### Methods

##### generateKeys

Generates Redis keys for sliding window operations.

```typescript
generateKeys(key: string, throttlerName: string): GeneratedKeys
```

**Parameters:**
- `key` - Base key identifier
- `throttlerName` - Name of the throttler

**Returns:** Object containing generated keys

**Example:**
```typescript
const keys = keyGenerator.generateKeys('user:123', 'api-throttler');
console.log('ZSET key:', keys.zKey);
console.log('Block key:', keys.blockKey);
```

##### generateMember

Generates a unique member for ZSET operations.

```typescript
generateMember(timestamp: number): string
```

**Parameters:**
- `timestamp` - Unix timestamp in milliseconds

**Returns:** Unique member string

### ThrottlerLogger

Specialized logger for throttler operations.

```typescript
class ThrottlerLogger
```

#### Methods

##### log

Logs general information.

```typescript
log(message: string, context?: Record<string, any>): void
```

##### error

Logs error information.

```typescript
error(message: string, error?: Error, context?: Record<string, any>): void
```

##### performance

Logs performance metrics.

```typescript
performance(operation: string, duration: number, context?: Record<string, any>): void
```

##### security

Logs security events.

```typescript
security(
  eventType: SecurityEventType,
  message: string,
  severity: SecurityEventSeverity,
  context?: Record<string, any>
): void
```

## Interfaces

### ThrottlerStorageRecord

Result of throttling operations.

```typescript
interface ThrottlerStorageRecord {
  totalHits: number;        // Current hit count in sliding window
  timeToExpire: number;     // Seconds until window expires
  isBlocked: boolean;       // Whether requests are currently blocked
  timeToBlockExpire: number; // Seconds until block expires (-1 if not blocked)
}
```

### SlidingWindowThrottlerConfig

Main configuration interface.

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

### RedisConfiguration

Redis connection configuration.

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

Async module configuration.

```typescript
interface SlidingWindowThrottlerAsyncConfig {
  useFactory?: (...args: any[]) => Promise<SlidingWindowThrottlerConfig> | SlidingWindowThrottlerConfig;
  inject?: any[];
  imports?: any[];
  useExisting?: any;
  useClass?: any;
}
```

### StorageMetrics

Comprehensive storage metrics.

```typescript
interface StorageMetrics {
  health: HealthMetrics;
  performance: PerformanceMetrics;
  security: SecurityMetrics;
  redis: RedisMetrics;
}
```

### HealthMetrics

Health status metrics.

```typescript
interface HealthMetrics {
  isHealthy: boolean;
  lastSuccessfulOperation: Date;
  consecutiveFailures: number;
  totalOperations: number;
  successRate: number;
}
```

### PerformanceMetrics

Performance metrics.

```typescript
interface PerformanceMetrics {
  averageResponseTime: number;
  operationsPerSecond: number;
  memoryUsage: number;
  cacheHitRate: number;
}
```

### SecurityMetrics

Security-related metrics.

```typescript
interface SecurityMetrics {
  rateLimitViolations: number;
  securityViolations: number;
  blockedRequests: number;
  suspiciousPatterns: number;
}
```

### RedisMetrics

Redis-specific metrics.

```typescript
interface RedisMetrics {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  functionsLoaded: boolean;
  memoryUsage: number;
  commandsExecuted: number;
  averageLatency: number;
}
```

## Enums

### FailureStrategy

Defines behavior when Redis is unavailable.

```typescript
enum FailureStrategy {
  FAIL_OPEN = 'fail-open',   // Allow requests when Redis is down
  FAIL_CLOSED = 'fail-closed' // Block requests when Redis is down
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
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}
```

### SecurityEventType

Types of security events.

```typescript
enum SecurityEventType {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_VIOLATION = 'RATE_LIMIT_VIOLATION',
  INJECTION_ATTEMPT = 'INJECTION_ATTEMPT',
  INVALID_KEY_FORMAT = 'INVALID_KEY_FORMAT',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  CONFIG_TAMPERING = 'CONFIG_TAMPERING',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS'
}
```

### SecurityEventSeverity

Severity levels for security events.

```typescript
enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}
```

### LogLevel

Logging levels.

```typescript
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}
```

## Functions

### Configuration Helpers

#### createDevelopmentConfiguration

Creates a development-optimized configuration.

```typescript
function createDevelopmentConfiguration(
  overrides?: Partial<Record<string, string>>
): SlidingWindowThrottlerConfig
```

**Parameters:**
- `overrides` - Environment variable overrides

**Returns:** Development configuration

**Example:**
```typescript
const config = createDevelopmentConfiguration({
  REDIS_HOST: 'localhost',
  ENABLE_DEBUG_LOGGING: 'true'
});
```

#### createProductionConfiguration

Creates a production-optimized configuration.

```typescript
function createProductionConfiguration(
  overrides?: Partial<Record<string, string>>
): SlidingWindowThrottlerConfig
```

**Parameters:**
- `overrides` - Environment variable overrides

**Returns:** Production configuration

**Example:**
```typescript
const config = createProductionConfiguration({
  REDIS_HOST: process.env.REDIS_HOST,
  FAILURE_STRATEGY: 'fail-closed'
});
```

#### createTestingConfiguration

Creates a testing-optimized configuration.

```typescript
function createTestingConfiguration(
  overrides?: Partial<Record<string, string>>
): SlidingWindowThrottlerConfig
```

**Parameters:**
- `overrides` - Environment variable overrides

**Returns:** Testing configuration

#### validateConfiguration

Validates configuration and returns validation results.

```typescript
function validateConfiguration(
  config: SlidingWindowThrottlerConfig
): ConfigurationValidationResult
```

**Parameters:**
- `config` - Configuration to validate

**Returns:** Validation result with errors and warnings

### Type Guards

#### isThrottlerStorageRecord

Type guard for ThrottlerStorageRecord.

```typescript
function isThrottlerStorageRecord(value: any): value is ThrottlerStorageRecord
```

**Parameters:**
- `value` - Value to check

**Returns:** True if value is a valid ThrottlerStorageRecord

#### isThrottlerError

Type guard for ThrottlerError.

```typescript
function isThrottlerError(error: any): error is ThrottlerError
```

**Parameters:**
- `error` - Error to check

**Returns:** True if error is a ThrottlerError

#### isFailureStrategy

Type guard for FailureStrategy.

```typescript
function isFailureStrategy(value: any): value is FailureStrategy
```

**Parameters:**
- `value` - Value to check

**Returns:** True if value is a valid FailureStrategy

### Utility Functions

#### maskSensitiveData

Masks sensitive data for logging.

```typescript
function maskSensitiveData(data: string): string
```

**Parameters:**
- `data` - Data to mask

**Returns:** Masked data string

**Example:**
```typescript
const masked = maskSensitiveData('user123@example.com');
// Returns: 'use***@example.com'
```

#### parseDuration

Parses duration strings into milliseconds.

```typescript
function parseDuration(duration: string): number
```

**Parameters:**
- `duration` - Duration string (e.g., '5m', '30s', '1h')

**Returns:** Duration in milliseconds

**Example:**
```typescript
const ms = parseDuration('5m'); // Returns: 300000
```

## Type Aliases

### FailureStrategy

```typescript
type FailureStrategy = 'fail-open' | 'fail-closed';
```

### GeneratedKeys

```typescript
type GeneratedKeys = {
  zKey: string;
  blockKey: string;
  hashTag?: string;
};
```

### ConfigurationValidationResult

```typescript
type ConfigurationValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
};
```

### ThrottlerMetrics

```typescript
type ThrottlerMetrics = {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  averageResponseTime: number;
  errorRate: number;
};
```

## Constants

### DEFAULT_CONFIG

Default configuration values.

```typescript
const DEFAULT_CONFIG: Readonly<SlidingWindowThrottlerConfig> = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0,
    keyPrefix: 'throttle',
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    tls: false,
  },
  failureStrategy: 'fail-open',
  enableDebugLogging: false,
  maxWindowSize: 1000,
  functionLibraryPrefix: 'sliding_window_throttler',
  enableRedisFunctions: true,
};
```

### REDIS_FUNCTION_LIBRARY

Redis Function library code.

```typescript
const REDIS_FUNCTION_LIBRARY: string;
```

### ERROR_MESSAGES

Predefined error messages.

```typescript
const ERROR_MESSAGES: Readonly<Record<ThrottlerErrorCode, string>>;
```

## Usage Examples

### Basic Usage

```typescript
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  createProductionConfiguration 
} from 'nestjs-sliding-window-throttler';

// Module configuration
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createProductionConfiguration()
    ),
  ],
})
export class AppModule {}

// Direct usage
const storage = new SlidingWindowThrottlerStorage(
  redis,
  config,
  functionsManager,
  keyGenerator
);

const result = await storage.increment('user:123', 60000, 10, 30000, 'api');
if (result.isBlocked) {
  throw new Error('Rate limit exceeded');
}
```

### Error Handling

```typescript
import { 
  isThrottlerError, 
  ThrottlerErrorCode,
  RedisConnectionError 
} from 'nestjs-sliding-window-throttler';

try {
  await storage.increment(key, ttl, limit, blockDuration, throttlerName);
} catch (error) {
  if (isThrottlerError(error)) {
    switch (error.code) {
      case ThrottlerErrorCode.REDIS_CONNECTION_FAILED:
        // Handle Redis connection issues
        break;
      case ThrottlerErrorCode.RATE_LIMIT_EXCEEDED:
        // Handle rate limit exceeded
        break;
      default:
        // Handle other throttler errors
    }
  }
}
```

### Configuration Validation

```typescript
import { validateConfiguration, createProductionConfiguration } from 'nestjs-sliding-window-throttler';

const config = createProductionConfiguration();
const validation = validateConfiguration(config);

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}
```

This API documentation provides comprehensive coverage of all public interfaces, classes, and functions available in the `nestjs-sliding-window-throttler` package. For more detailed examples and usage patterns, see the [examples directory](../examples/).