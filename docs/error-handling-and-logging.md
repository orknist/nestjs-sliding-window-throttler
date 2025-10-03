# Error Handling and Logging

This document describes the comprehensive error handling and logging features of the `nestjs-sliding-window-throttler` package.

## Overview

The package provides a robust error handling and logging system that includes:

- **Structured Error Classes**: Specific error types for different failure scenarios
- **Error Recovery Strategies**: Automatic recovery mechanisms for common failures
- **Comprehensive Logging**: Configurable logging with performance and security monitoring
- **Graceful Degradation**: Fail-open/fail-closed strategies when Redis is unavailable
- **Security Event Logging**: Specialized logging for security-related events

## Error Handling

### Error Types

The package defines several specialized error classes:

#### ThrottlerError (Base Class)
```typescript
import { ThrottlerError, ThrottlerErrorCode } from 'nestjs-sliding-window-throttler';

try {
  // Some operation
} catch (error) {
  if (error instanceof ThrottlerError) {
    console.log('Error code:', error.code);
    console.log('Severity:', error.severity);
    console.log('Is recoverable:', error.isRecoverable);
    console.log('Recovery suggestion:', error.getRecoverySuggestion());
  }
}
```

#### Specific Error Types

```typescript
import {
  RedisConnectionError,
  RedisFunctionsNotSupportedError,
  RedisFunctionsLoadError,
  InvalidConfigurationError,
  RateLimitExceededError,
  StorageOperationError,
  SecurityViolationError,
} from 'nestjs-sliding-window-throttler';

// Redis connection failures
throw new RedisConnectionError('Connection failed', originalError, { host: 'localhost', port: 6379 });

// Configuration errors
throw new InvalidConfigurationError('Invalid TTL value', 'ttl', { providedValue: -1 });

// Rate limit violations
throw new RateLimitExceededError('Rate limit exceeded', 10, 15, 60, { clientId: 'user123' });

// Security violations
throw new SecurityViolationError('Injection attempt detected', SecurityViolationType.REDIS_INJECTION);
```

### Error Recovery

The package includes an automatic error recovery system:

```typescript
import { ErrorRecoveryManager } from 'nestjs-sliding-window-throttler';

const recoveryManager = new ErrorRecoveryManager();

try {
  // Operation that might fail
} catch (error) {
  if (isThrottlerError(error) && error.isRecoverable) {
    try {
      const result = await recoveryManager.recover(error, {
        redis: redisClient,
        functionsManager: functionsManager,
        config: throttlerConfig,
      });
      
      console.log('Recovery successful:', result.strategy);
      return result.result; // Use recovered result
    } catch (recoveryError) {
      console.log('Recovery failed, using original error');
      throw error;
    }
  }
}
```

### Built-in Recovery Strategies

1. **Redis Connection Recovery**: Attempts to reconnect with exponential backoff
2. **Redis Functions Recovery**: Falls back to Lua scripts when functions fail
3. **Graceful Degradation**: Returns fail-open or fail-closed results based on configuration

## Logging System

### Logger Configuration

```typescript
import { ThrottlerLogger, LoggerFactory, LogLevel } from 'nestjs-sliding-window-throttler';

// Create a logger with custom configuration
const logger = LoggerFactory.create('MyService', {
  level: LogLevel.DEBUG,
  console: true,
  json: false,
  performance: true,
  security: true,
  formatters: {
    console: (entry) => `[${entry.timestamp}] ${entry.level} ${entry.message}`,
  },
  filters: {
    level: (level) => level !== LogLevel.DEBUG, // Filter out debug messages
  },
});
```

### Basic Logging

```typescript
// Different log levels
logger.debug('Debug information', { userId: 'user123' });
logger.info('Operation completed', { duration: 150 });
logger.warn('High memory usage detected', { usage: 0.85 });
logger.error('Operation failed', error, { operation: 'increment' });
logger.critical('System failure', error, { component: 'redis' });
```

### Performance Monitoring

```typescript
// Method 1: Manual timing
logger.performance('database-query', 150, { query: 'SELECT * FROM users' });

// Method 2: Automatic timing
const endTiming = logger.startTiming('api-request');
try {
  // Your operation here
  const result = await someAsyncOperation();
  endTiming({ success: true, itemsProcessed: result.length });
} catch (error) {
  endTiming({ success: false, error: error.message });
  throw error;
}

// Get performance metrics
const metrics = logger.getPerformanceMetrics();
console.log('Average response time:', metrics[0].averageDuration);
```

### Security Event Logging

```typescript
import { SecurityEventType, SecurityEventSeverity } from 'nestjs-sliding-window-throttler';

// Log security events
logger.security(
  SecurityEventType.RATE_LIMIT_EXCEEDED,
  'Rate limit exceeded for client',
  SecurityEventSeverity.HIGH,
  {
    clientId: 'user123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    rateLimit: {
      key: 'user:123',
      limit: 10,
      current: 15,
      resetTime: 60,
      throttlerName: 'api-throttler',
    },
  },
);

// Rate limit specific events
logger.rateLimitEvent('exceeded', 'user:123', 'api-throttler', {
  limit: 10,
  current: 15,
  resetTime: 60,
  clientId: 'user123',
  ipAddress: '192.168.1.100',
});
```

## Integration with Storage

The `SlidingWindowThrottlerStorage` class automatically integrates with the error handling and logging system:

```typescript
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';

// The storage class automatically:
// 1. Logs all operations with performance metrics
// 2. Handles errors with recovery strategies
// 3. Logs security events for rate limit violations
// 4. Provides comprehensive health metrics

const storage = new SlidingWindowThrottlerStorage(redis, config, functionsManager, keyGenerator);

try {
  const result = await storage.increment('user:123', 60000, 10, 30000, 'api-throttler');
  // Automatically logged with performance metrics
} catch (error) {
  // Automatically handled with recovery strategies
  // Security events logged if applicable
}

// Get comprehensive metrics
const metrics = await storage.getMetrics();
console.log('Health:', metrics.health);
console.log('Performance:', metrics.performance);
console.log('Security:', metrics.security);
```

## Configuration Options

### Logger Configuration

```typescript
interface LoggerConfig {
  level: LogLevel;                    // Minimum log level
  name: string;                       // Logger name
  console: boolean;                   // Enable console output
  file?: {                           // File output configuration
    enabled: boolean;
    path: string;
    maxSize?: string;
    maxFiles?: number;
  };
  json: boolean;                      // JSON format output
  performance: boolean;               // Enable performance logging
  security: boolean;                  // Enable security logging
  formatters?: {                      // Custom formatters
    console?: (entry: LogEntry) => string;
    file?: (entry: LogEntry) => string;
    json?: (entry: LogEntry) => string;
  };
  filters?: {                         // Log filters
    level?: (level: LogLevel) => boolean;
    message?: (message: string) => boolean;
    context?: (context: Record<string, any>) => boolean;
  };
}
```

### Throttler Configuration

```typescript
interface SlidingWindowThrottlerConfig {
  redis: RedisConfiguration;
  failureStrategy: 'fail-open' | 'fail-closed';  // Error recovery strategy
  enableDebugLogging?: boolean;                   // Enable debug logging
  maxWindowSize?: number;
  functionLibraryPrefix?: string;
  enableRedisFunctions?: boolean;
}
```

## Best Practices

### 1. Error Handling

```typescript
// Always check for specific error types
if (error instanceof RedisConnectionError) {
  // Handle Redis connection issues
} else if (error instanceof SecurityViolationError) {
  // Handle security violations
} else if (isThrottlerError(error)) {
  // Handle other throttler errors
}

// Use error recovery for resilient applications
try {
  const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
} catch (error) {
  if (isRecoverableError(error)) {
    const recovered = await errorRecoveryManager.recover(error, context);
    if (recovered.recovered) {
      return recovered.result;
    }
  }
  throw error;
}
```

### 2. Logging

```typescript
// Use appropriate log levels
logger.debug('Detailed debugging info');     // Development only
logger.info('Normal operation info');        // General information
logger.warn('Warning conditions');           // Potential issues
logger.error('Error conditions');            // Errors that need attention
logger.critical('Critical failures');        // System failures

// Include relevant context
logger.info('Rate limit check', {
  key: maskSensitiveData(key),
  limit,
  current: result.totalHits,
  allowed: !result.isBlocked,
});

// Use performance monitoring for critical operations
const endTiming = logger.startTiming('critical-operation');
try {
  const result = await criticalOperation();
  endTiming({ success: true, resultSize: result.length });
} catch (error) {
  endTiming({ success: false, error: error.message });
  throw error;
}
```

### 3. Security

```typescript
// Always mask sensitive data in logs
function maskSensitiveData(data: string): string {
  if (data.length <= 8) return '*'.repeat(data.length);
  return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
}

// Log security events appropriately
logger.security(
  SecurityEventType.RATE_LIMIT_EXCEEDED,
  'Rate limit exceeded',
  SecurityEventSeverity.MEDIUM,
  {
    clientId: maskSensitiveData(clientId),
    // Include relevant security context
  },
);
```

### 4. Monitoring

```typescript
// Regularly check metrics
setInterval(async () => {
  const metrics = await storage.getMetrics();
  
  if (metrics.health.consecutiveFailures > 5) {
    logger.critical('High failure rate detected', undefined, metrics.health);
  }
  
  if (metrics.security.securityViolations > 10) {
    logger.security(
      SecurityEventType.SUSPICIOUS_PATTERN,
      'High number of security violations',
      SecurityEventSeverity.HIGH,
      { violations: metrics.security.securityViolations },
    );
  }
}, 60000); // Check every minute
```

## Error Codes Reference

| Code | Description | Recoverable | Suggested Action |
|------|-------------|-------------|------------------|
| `REDIS_CONNECTION_FAILED` | Redis connection failed | Yes | Check Redis connectivity, use fail-open strategy |
| `REDIS_FUNCTIONS_NOT_SUPPORTED` | Redis version < 7.0 | Yes | Upgrade Redis or disable functions |
| `REDIS_FUNCTIONS_LOAD_FAILED` | Function loading failed | Yes | Check permissions, reload library |
| `INVALID_CONFIGURATION` | Invalid config parameters | No | Fix configuration |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Yes | Implement backoff strategy |
| `STORAGE_OPERATION_FAILED` | Storage operation failed | Yes | Retry operation |
| `KEY_GENERATION_FAILED` | Key generation failed | Yes | Check key parameters |
| `SECURITY_VIOLATION` | Security violation detected | No | Investigate security issue |

## Security Event Types

| Event Type | Description | Typical Severity |
|------------|-------------|------------------|
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | Medium |
| `RATE_LIMIT_VIOLATION` | Suspicious rate limit pattern | High |
| `INJECTION_ATTEMPT` | Potential injection attack | High |
| `INVALID_KEY_FORMAT` | Invalid key format detected | Medium |
| `SUSPICIOUS_PATTERN` | Suspicious request pattern | Medium-High |
| `CONFIG_TAMPERING` | Configuration tampering | Critical |
| `UNAUTHORIZED_ACCESS` | Unauthorized access attempt | High |

## Examples

See the [error handling example](../examples/error-handling/error-handling-example.ts) for a complete implementation demonstrating all features.