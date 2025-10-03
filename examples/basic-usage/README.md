# Basic Usage Example

This example demonstrates the simplest way to integrate `nestjs-sliding-window-throttler` into your NestJS application.

## Quick Start

### 1. Install the Package

```bash
npm install nestjs-sliding-window-throttler
```

### 2. Set Environment Variables

Create a `.env` file:

```bash
# Required Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional Redis Configuration
REDIS_PASSWORD=your-password-here
REDIS_DB=0
REDIS_KEY_PREFIX=throttle

# Throttler Configuration
FAILURE_STRATEGY=fail-open
ENABLE_DEBUG_LOGGING=false
MAX_WINDOW_SIZE=1000
ENABLE_REDIS_FUNCTIONS=true
```

### 3. Configure Your Module

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  createConfig 
} from 'nestjs-sliding-window-throttler';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Configure sliding window throttler (reads from environment)
    SlidingWindowThrottlerModule.forRoot(createConfig()),
    
    // Configure @nestjs/throttler to use sliding window storage
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000, // 1 minute
            limit: 10, // 10 requests per minute
            blockDuration: 5 * 60 * 1000, // Block for 5 minutes
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 4. Use in Controllers

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  @Post('sensitive')
  @Throttle({ default: { limit: 2, ttl: 60 * 1000 } })
  postSensitive(): string {
    return 'Sensitive operation completed!';
  }
}
```

## Running the Example

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm run start:dev
   ```

4. **Test rate limiting:**
   ```bash
   # Make multiple requests quickly
   for i in {1..15}; do
     curl -w "%{http_code}\n" -o /dev/null -s http://localhost:3000/
   done
   ```

   You should see:
   - First 10 requests: `200`
   - Next 5 requests: `429` (rate limited)

## Key Features Demonstrated

- ✅ **Simple configuration** using environment variables
- ✅ **Automatic Redis Functions** loading for optimal performance
- ✅ **Sliding window accuracy** - more precise than fixed windows
- ✅ **Block duration** - temporarily block clients after limit exceeded
- ✅ **Graceful failure handling** - fail-open strategy for Redis issues

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | ✅ | - | Redis server hostname |
| `REDIS_PORT` | ✅ | - | Redis server port |
| `REDIS_PASSWORD` | ❌ | - | Redis password |
| `REDIS_DB` | ❌ | `0` | Redis database number (0-15) |
| `REDIS_KEY_PREFIX` | ❌ | `throttle` | Key prefix for Redis keys |
| `FAILURE_STRATEGY` | ❌ | `fail-open` | `fail-open` or `fail-closed` |
| `ENABLE_DEBUG_LOGGING` | ❌ | `false` | Enable debug logging |
| `MAX_WINDOW_SIZE` | ❌ | `1000` | Maximum sliding window size |
| `ENABLE_REDIS_FUNCTIONS` | ❌ | `true` | Use Redis Functions when available |

### Throttler Configuration

```typescript
{
  name: 'default',        // Throttler name
  ttl: 60 * 1000,        // Time window in milliseconds
  limit: 10,             // Maximum requests in window
  blockDuration: 300000, // Block duration after limit exceeded (optional)
}
```

## Comparison with Default Throttler

| Feature | Default @nestjs/throttler | Sliding Window Throttler |
|---------|--------------------------|-------------------------|
| **Window Type** | Fixed | Sliding |
| **Accuracy** | ~70% | ~99% |
| **Redis Operations** | 2-3 per request | 1 per request |
| **Memory Usage** | High (no cleanup) | Optimized |
| **Block Duration** | ❌ | ✅ |
| **Cluster Support** | Limited | Full |

## Next Steps

- 📖 See [Advanced Configuration](../advanced-config/) for Redis cluster setup
- 🔧 See [Error Handling](../error-handling/) for comprehensive error management
- 🚀 See [Migration Guide](../migration-guide/) to upgrade from default throttler

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker logs <redis-container-id>
```

### Rate Limiting Not Working

1. **Check Redis Functions:**
   ```bash
   redis-cli FUNCTION LIST
   ```

2. **Enable debug logging:**
   ```bash
   ENABLE_DEBUG_LOGGING=true
   ```

3. **Validate configuration:**
   ```typescript
   import { createConfig, validateConfig } from 'nestjs-sliding-window-throttler';
   const config = createConfig();
   const { warnings } = validateConfig(config);
   console.log('Config warnings:', warnings);
   ```

### Performance Issues

1. **Monitor Redis memory:**
   ```bash
   redis-cli INFO memory
   ```

2. **Check window sizes:**
   ```bash
   redis-cli ZCARD "throttle:*"
   ```

3. **Adjust MAX_WINDOW_SIZE:**
   ```bash
   MAX_WINDOW_SIZE=500  # Reduce if memory usage is high
   ```