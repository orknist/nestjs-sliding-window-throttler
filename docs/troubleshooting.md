# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the `nestjs-sliding-window-throttler` package.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Redis Issues](#redis-issues)
- [Configuration Issues](#configuration-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)
- [Development Issues](#development-issues)
- [Production Issues](#production-issues)
- [Debugging Tools](#debugging-tools)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check

First, run a quick health check to identify the issue:

```typescript
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';

// Get comprehensive health status
const metrics = await storage.getMetrics();
console.log('Health Status:', metrics.health);
console.log('Redis Status:', metrics.redis);
console.log('Performance:', metrics.performance);

// Check specific components
console.log('Redis Connected:', metrics.redis.connectionStatus === 'connected');
console.log('Functions Loaded:', metrics.redis.functionsLoaded);
console.log('Success Rate:', metrics.health.successRate);
```

### Environment Check

Verify your environment setup:

```bash
# Check Node.js version (requires 18+)
node --version

# Check Redis version (requires 7.0+ for functions)
redis-cli INFO server | grep redis_version

# Check Redis connectivity
redis-cli ping

# Check environment variables
echo $REDIS_HOST
echo $REDIS_PORT
echo $FAILURE_STRATEGY
```

### Configuration Validation

Validate your configuration:

```typescript
import { validateConfiguration, createProductionConfiguration } from 'nestjs-sliding-window-throttler';

const config = createProductionConfiguration();
const validation = validateConfiguration(config);

if (!validation.isValid) {
  console.error('❌ Configuration Errors:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  Configuration Warnings:');
  validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

if (validation.recommendations.length > 0) {
  console.info('💡 Recommendations:');
  validation.recommendations.forEach(rec => console.info(`  - ${rec}`));
}
```

## Common Issues

### 1. "Redis connection failed"

**Symptoms:**
- Application fails to start
- Error: `REDIS_CONNECTION_FAILED`
- Timeout errors

**Diagnosis:**
```bash
# Test Redis connectivity
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Check Redis logs
redis-cli -h $REDIS_HOST -p $REDIS_PORT MONITOR

# Test with telnet
telnet $REDIS_HOST $REDIS_PORT
```

**Solutions:**

1. **Check Redis server status:**
   ```bash
   # Start Redis if not running
   redis-server
   
   # Or with Docker
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Verify connection parameters:**
   ```typescript
   // Check your configuration
   const config = {
     redis: {
       host: 'localhost', // Correct host?
       port: 6379,        // Correct port?
       password: 'secret', // Required password?
       db: 0,             // Correct database?
     }
   };
   ```

3. **Network issues:**
   ```bash
   # Check firewall
   sudo ufw status
   
   # Check if port is open
   nmap -p 6379 $REDIS_HOST
   
   # Check DNS resolution
   nslookup $REDIS_HOST
   ```

4. **Use fail-open strategy during development:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     failureStrategy: 'fail-open', // Allow requests if Redis is down
     // ... other config
   });
   ```

### 2. "Redis Functions not supported"

**Symptoms:**
- Error: `REDIS_FUNCTIONS_NOT_SUPPORTED`
- Fallback to Lua scripts
- Performance degradation

**Diagnosis:**
```bash
# Check Redis version
redis-cli INFO server | grep redis_version

# Test function support
redis-cli FUNCTION LIST
```

**Solutions:**

1. **Upgrade Redis to 7.0+:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install redis-server=7:7.0.*
   
   # Docker
   docker run -d -p 6379:6379 redis:7-alpine
   
   # macOS with Homebrew
   brew upgrade redis
   ```

2. **Disable Redis Functions (fallback to Lua):**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     enableRedisFunctions: false, // Use Lua scripts instead
     // ... other config
   });
   ```

3. **Check Redis configuration:**
   ```bash
   # Ensure functions are enabled
   redis-cli CONFIG GET enable-protected-configs
   redis-cli CONFIG GET enable-module-command
   ```

### 3. "Configuration validation failed"

**Symptoms:**
- Application fails to start
- Error: `INVALID_CONFIGURATION`
- Missing environment variables

**Diagnosis:**
```bash
# Check environment variables
env | grep REDIS
env | grep THROTTLE
env | grep FAILURE

# Validate .env file
cat .env
```

**Solutions:**

1. **Set required environment variables:**
   ```bash
   # Create .env file
   cat > .env << EOF
   REDIS_HOST=localhost
   REDIS_PORT=6379
   FAILURE_STRATEGY=fail-open
   ENABLE_DEBUG_LOGGING=true
   EOF
   ```

2. **Use configuration helpers:**
   ```typescript
   import { createDevelopmentConfiguration } from 'nestjs-sliding-window-throttler';
   
   // Automatically sets sensible defaults
   SlidingWindowThrottlerModule.forRoot(
     createDevelopmentConfiguration()
   );
   ```

3. **Validate configuration programmatically:**
   ```typescript
   const config = createProductionConfiguration();
   const validation = validateConfiguration(config);
   
   if (!validation.isValid) {
     throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
   }
   ```

### 4. "Rate limit not working correctly"

**Symptoms:**
- Requests not being throttled
- Incorrect hit counts
- Blocking not working

**Diagnosis:**
```typescript
// Enable debug logging
const config = {
  enableDebugLogging: true,
  // ... other config
};

// Check throttler configuration
console.log('Throttler config:', throttlerConfig);

// Test manually
const result = await storage.increment('test-key', 60000, 5, 0, 'test');
console.log('Result:', result);
```

**Solutions:**

1. **Check throttler configuration:**
   ```typescript
   ThrottlerModule.forRootAsync({
     imports: [SlidingWindowThrottlerModule],
     inject: [SlidingWindowThrottlerStorage],
     useFactory: (storage: SlidingWindowThrottlerStorage) => ({
       throttlers: [
         {
           name: 'default',
           ttl: 60000,  // 1 minute in milliseconds
           limit: 100,  // 100 requests per minute
         },
       ],
       storage, // Make sure to use the custom storage
     }),
   });
   ```

2. **Verify decorator usage:**
   ```typescript
   @Controller('api')
   export class ApiController {
     @Get('data')
     @Throttle({ default: { limit: 10, ttl: 60000 } }) // Correct usage
     async getData() {
       return { data: 'example' };
     }
   }
   ```

3. **Check key generation:**
   ```typescript
   // Custom key generator for debugging
   class DebugKeyGenerator extends KeyGenerator {
     generateKeys(key: string, throttlerName: string) {
       const result = super.generateKeys(key, throttlerName);
       console.log('Generated keys:', result);
       return result;
     }
   }
   ```

## Redis Issues

### Redis Memory Issues

**Symptoms:**
- High memory usage
- Redis OOM errors
- Slow performance

**Diagnosis:**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE

# Find large keys
redis-cli --bigkeys

# Monitor memory usage
redis-cli INFO memory | grep used_memory_human
```

**Solutions:**

1. **Configure memory limits:**
   ```bash
   # Set max memory
   redis-cli CONFIG SET maxmemory 1gb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

2. **Optimize throttler configuration:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     maxWindowSize: 500,        // Reduce window size
     redis: {
       keyPrefix: 'throttle:',  // Use shorter prefix
     },
     // ... other config
   });
   ```

3. **Enable automatic cleanup:**
   ```bash
   # Set TTL on keys
   redis-cli CONFIG SET timeout 300
   ```

### Redis Cluster Issues

**Symptoms:**
- CROSSSLOT errors
- Inconsistent behavior
- Connection issues

**Diagnosis:**
```bash
# Check cluster status
redis-cli CLUSTER NODES
redis-cli CLUSTER INFO

# Test key distribution
redis-cli CLUSTER KEYSLOT "throttle:user:123"
```

**Solutions:**

1. **Use hash tags:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     redis: {
       keyPrefix: 'throttle:{hash}', // Ensures same slot
     },
     // ... other config
   });
   ```

2. **Configure cluster client:**
   ```typescript
   import { Cluster } from 'ioredis';
   
   const cluster = new Cluster([
     { host: 'redis-1', port: 6379 },
     { host: 'redis-2', port: 6379 },
     { host: 'redis-3', port: 6379 },
   ]);
   ```

## Performance Issues

### Slow Response Times

**Symptoms:**
- High latency
- Timeouts
- Poor throughput

**Diagnosis:**
```typescript
// Enable performance monitoring
const logger = LoggerFactory.create('Performance', {
  performance: true,
});

// Monitor operation times
const endTiming = logger.startTiming('throttle-check');
const result = await storage.increment(key, ttl, limit, blockDuration, throttlerName);
endTiming({ success: true });

// Check metrics
const metrics = await storage.getMetrics();
console.log('Average response time:', metrics.performance.averageResponseTime);
```

**Solutions:**

1. **Optimize Redis configuration:**
   ```bash
   # Increase timeout values
   redis-cli CONFIG SET timeout 0
   redis-cli CONFIG SET tcp-keepalive 300
   ```

2. **Use connection pooling:**
   ```typescript
   const redis = new Redis({
     host: 'localhost',
     port: 6379,
     maxRetriesPerRequest: 3,
     retryDelayOnFailover: 100,
     lazyConnect: true,
   });
   ```

3. **Optimize window size:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     maxWindowSize: 100, // Smaller window for better performance
     // ... other config
   });
   ```

### High Memory Usage

**Symptoms:**
- Increasing memory consumption
- Memory leaks
- OOM errors

**Diagnosis:**
```bash
# Monitor memory usage
watch -n 1 'redis-cli INFO memory | grep used_memory_human'

# Check for memory leaks
redis-cli --latency-history -i 1

# Profile memory usage
node --inspect --max-old-space-size=4096 app.js
```

**Solutions:**

1. **Configure cleanup:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     maxWindowSize: 500,
     redis: {
       keyPrefix: 'throttle:',
     },
     // ... other config
   });
   ```

2. **Set appropriate TTLs:**
   ```typescript
   @Throttle({ 
     default: { 
       limit: 100, 
       ttl: 60000, // Keep TTL reasonable
     } 
   })
   ```

## Security Issues

### Rate Limit Bypass

**Symptoms:**
- Users exceeding rate limits
- Inconsistent blocking
- Security violations

**Diagnosis:**
```typescript
// Enable security logging
const logger = LoggerFactory.create('Security', {
  security: true,
});

// Monitor security events
logger.security(
  SecurityEventType.RATE_LIMIT_EXCEEDED,
  'Rate limit exceeded',
  SecurityEventSeverity.HIGH,
  { key, limit, current: result.totalHits }
);
```

**Solutions:**

1. **Use fail-closed in production:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     failureStrategy: 'fail-closed', // Block requests if Redis fails
     // ... other config
   });
   ```

2. **Implement proper key generation:**
   ```typescript
   // Use IP + User ID for better security
   const key = `${req.ip}:${req.user?.id || 'anonymous'}`;
   ```

3. **Add block duration:**
   ```typescript
   @Throttle({ 
     default: { 
       limit: 10, 
       ttl: 60000,
       blockDuration: 300000, // Block for 5 minutes
     } 
   })
   ```

### Key Injection Attacks

**Symptoms:**
- Unusual key patterns
- Security violations
- Unexpected behavior

**Diagnosis:**
```typescript
// Enable key sanitization
SlidingWindowThrottlerModule.forRoot({
  enableKeySanitization: true,
  maxKeyLength: 256,
  // ... other config
});
```

**Solutions:**

1. **Sanitize keys:**
   ```typescript
   function sanitizeKey(key: string): string {
     return key.replace(/[^a-zA-Z0-9:_-]/g, '_').substring(0, 256);
   }
   ```

2. **Validate input:**
   ```typescript
   if (!/^[a-zA-Z0-9:_-]+$/.test(key)) {
     throw new SecurityViolationError('Invalid key format');
   }
   ```

## Development Issues

### Testing Issues

**Symptoms:**
- Tests failing
- Inconsistent results
- Setup problems

**Solutions:**

1. **Use testing configuration:**
   ```typescript
   import { createTestingConfiguration } from 'nestjs-sliding-window-throttler';
   
   beforeEach(async () => {
     const module = await Test.createTestingModule({
       imports: [
         SlidingWindowThrottlerModule.forRoot(
           createTestingConfiguration({
             REDIS_DB: '15', // Use separate test database
           })
         ),
       ],
     }).compile();
   });
   ```

2. **Clean up between tests:**
   ```typescript
   afterEach(async () => {
     await redis.flushdb(); // Clear test database
   });
   ```

3. **Mock Redis for unit tests:**
   ```typescript
   const mockRedis = {
     fcall: jest.fn(),
     exists: jest.fn(),
     pttl: jest.fn(),
   };
   ```

### Hot Reload Issues

**Symptoms:**
- Module not reloading
- Stale connections
- Memory leaks

**Solutions:**

1. **Proper cleanup:**
   ```typescript
   export class AppModule implements OnModuleDestroy {
     constructor(private readonly redis: Redis) {}
     
     async onModuleDestroy() {
       await this.redis.disconnect();
     }
   }
   ```

2. **Use lazy connections:**
   ```typescript
   const redis = new Redis({
     lazyConnect: true,
     maxRetriesPerRequest: 1,
   });
   ```

## Production Issues

### High Load Issues

**Symptoms:**
- Performance degradation
- Timeouts
- Connection pool exhaustion

**Solutions:**

1. **Scale Redis:**
   ```bash
   # Use Redis cluster
   redis-cli --cluster create \
     127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
     --cluster-replicas 1
   ```

2. **Optimize configuration:**
   ```typescript
   SlidingWindowThrottlerModule.forRoot({
     redis: {
       maxRetriesPerRequest: 3,
       retryDelayOnFailover: 100,
       connectTimeout: 5000,
       commandTimeout: 2000,
     },
     maxWindowSize: 100,
     // ... other config
   });
   ```

### Monitoring and Alerting

**Setup monitoring:**

```typescript
// Custom metrics collection
setInterval(async () => {
  const metrics = await storage.getMetrics();
  
  // Send to monitoring system
  if (metrics.health.successRate < 0.95) {
    alert('Throttler success rate below 95%');
  }
  
  if (metrics.performance.averageResponseTime > 100) {
    alert('High throttler response time');
  }
}, 60000);
```

## Debugging Tools

### Enable Debug Logging

```bash
# Environment variable
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug

# Or in configuration
SlidingWindowThrottlerModule.forRoot({
  enableDebugLogging: true,
  // ... other config
});
```

### Redis Monitoring

```bash
# Monitor Redis commands
redis-cli MONITOR

# Check slow queries
redis-cli SLOWLOG GET 10

# Monitor memory usage
redis-cli --latency-history -i 1
```

### Performance Profiling

```typescript
// Enable performance monitoring
const logger = LoggerFactory.create('Profiler', {
  performance: true,
});

// Profile operations
const endTiming = logger.startTiming('operation');
try {
  const result = await operation();
  endTiming({ success: true, resultSize: result.length });
} catch (error) {
  endTiming({ success: false, error: error.message });
  throw error;
}
```

### Health Checks

```typescript
// Implement health check endpoint
@Controller('health')
export class HealthController {
  constructor(private readonly storage: SlidingWindowThrottlerStorage) {}
  
  @Get('throttler')
  async checkThrottler() {
    const metrics = await this.storage.getMetrics();
    
    return {
      status: metrics.health.isHealthy ? 'healthy' : 'unhealthy',
      redis: metrics.redis.connectionStatus,
      functions: metrics.redis.functionsLoaded,
      performance: metrics.performance,
    };
  }
}
```

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Enable debug logging** and collect logs
3. **Run health checks** and collect metrics
4. **Test with minimal configuration**
5. **Check Redis connectivity** independently

### Information to Include

When reporting issues, please include:

- **Package version:** `npm list nestjs-sliding-window-throttler`
- **Node.js version:** `node --version`
- **NestJS version:** `npm list @nestjs/common`
- **Redis version:** `redis-cli INFO server | grep redis_version`
- **Configuration:** (sanitized, no passwords)
- **Error messages:** Full stack traces
- **Debug logs:** With debug logging enabled
- **Health metrics:** Output from `storage.getMetrics()`

### Support Channels

- 📖 [Documentation](../README.md)
- 🐛 [Issue Tracker](https://github.com/orknist/nestjs-sliding-window-throttler/issues)
- 💬 [Discussions](https://github.com/orknist/nestjs-sliding-window-throttler/discussions)
- 📧 [Email Support](mailto:support@example.com)

### Creating a Minimal Reproduction

```typescript
// minimal-reproduction.ts
import { Module } from '@nestjs/common';
import { SlidingWindowThrottlerModule, createDevelopmentConfiguration } from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createDevelopmentConfiguration()
    ),
  ],
})
export class MinimalModule {}

// Test the issue with minimal setup
async function test() {
  // Your reproduction code here
}

test().catch(console.error);
```

This troubleshooting guide should help you resolve most common issues. If you're still experiencing problems, please don't hesitate to reach out through our support channels.