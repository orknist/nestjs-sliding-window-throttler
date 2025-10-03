# NestJS Sliding Window Throttler

[![npm version](https://badge.fury.io/js/nestjs-sliding-window-throttler.svg)](https://badge.fury.io/js/nestjs-sliding-window-throttler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Node.js CI](https://github.com/orknist/nestjs-sliding-window-throttler/workflows/Node.js%20CI/badge.svg)](https://github.com/orknist/nestjs-sliding-window-throttler/actions)

A simplified, production-ready sliding window rate limiter for NestJS applications using Redis Functions. Focused on core functionality with clean, maintainable code.

## ✨ Features

- 🚀 **High Performance**: Uses Redis Functions (Redis 7.0+) with Lua script fallback
- 🎯 **Precise Rate Limiting**: Sliding window algorithm for accurate rate limiting
- 🔧 **Drop-in Replacement**: Compatible with existing `@nestjs/throttler` decorators
- 🛡️ **Failure Strategies**: Simple fail-open/fail-closed behavior
- 📊 **Block Duration**: Optional request blocking after rate limit exceeded
- 🔍 **TypeScript**: Full TypeScript support with clean type definitions
- 🛠️ **Production Ready**: Simple error handling and flexible logging
- 📈 **Lightweight**: Focused on core functionality without over-engineering
- 🔌 **Observability Ready**: Logger interface for custom observability integration

## 📦 Installation

```bash
npm install nestjs-sliding-window-throttler
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/throttler ioredis reflect-metadata
```

## 🔧 Requirements

- **Node.js**: 18.0.0 or higher
- **NestJS**: 10.0.0 or higher  
- **Redis**: 6.0.0 or higher (Redis 7.0+ recommended for Redis Functions)
- **ioredis**: 5.0.0 or higher

> **Note**: Redis Functions are used when available (Redis 7.0+) with automatic fallback to Lua scripts for older versions.

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  RedisFailureStrategy 
} from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    // Configure the sliding window throttler
    SlidingWindowThrottlerModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      failureStrategy: RedisFailureStrategy.FAIL_OPEN,
    }),
    
    // Configure NestJS throttler to use our storage
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      inject: [SlidingWindowThrottlerStorage],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
        ],
        storage,
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. Environment Variables Setup

Create a `.env` file:

```bash
# Required Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional Configuration
REDIS_PASSWORD=your-password
REDIS_DB=0
REDIS_KEY_PREFIX=throttle

# Throttler Configuration  
FAILURE_STRATEGY=fail-open
ENABLE_DEBUG_LOGGING=false
MAX_WINDOW_SIZE=1000
ENABLE_REDIS_FUNCTIONS=true
```

### 3. Using Environment Variables

```typescript
import { SlidingWindowThrottlerModule, createConfig } from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    // Automatically reads from process.env
    SlidingWindowThrottlerModule.forRoot(createConfig()),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      inject: [SlidingWindowThrottlerStorage],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          { name: 'default', ttl: 60000, limit: 100 },
          { name: 'strict', ttl: 60000, limit: 10 },
        ],
        storage,
      }),
    }),
  ],
})
export class AppModule {}
```

## 📝 Usage with Decorators

The package works seamlessly with existing `@nestjs/throttler` decorators:

### Basic Usage

```typescript
import { Controller, Post, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async login() {
    // Your login logic
  }

  @Post('send-otp')
  @Throttle({ 'send-otp': { limit: 3, ttl: 300000 } }) // 3 requests per 5 minutes
  async sendOtp() {
    // Your OTP logic
  }

  @Get('profile')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  async getProfile() {
    // Your profile logic
  }
}
```

### Advanced Usage with Block Duration

```typescript
@Controller('api')
export class ApiController {
  @Post('upload')
  @Throttle({ 
    upload: { 
      limit: 5, 
      ttl: 60000, // 1 minute window
      blockDuration: 300000 // Block for 5 minutes after limit exceeded
    } 
  })
  async uploadFile() {
    // File upload logic
  }

  @Post('heavy-operation')
  @Throttle({ 
    heavy: { 
      limit: 2, 
      ttl: 300000, // 5 minute window
      blockDuration: 600000 // Block for 10 minutes
    } 
  })
  async heavyOperation() {
    // Heavy operation logic
  }
}
```

### Multiple Throttlers

```typescript
@Controller('api')
export class ApiController {
  @Get('data')
  @Throttle([
    { name: 'default', limit: 100, ttl: 60000 }, // 100/minute general limit
    { name: 'burst', limit: 10, ttl: 1000 },     // 10/second burst limit
  ])
  async getData() {
    // Your data logic
  }
}
```

## ⚙️ Configuration

### Basic Configuration

```typescript
import { 
  SlidingWindowThrottlerModule, 
  RedisFailureStrategy 
} from 'nestjs-sliding-window-throttler';

SlidingWindowThrottlerModule.forRoot({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password', // optional
    db: 0, // optional
    keyPrefix: 'throttle', // optional
  },
  failureStrategy: RedisFailureStrategy.FAIL_OPEN, // or RedisFailureStrategy.FAIL_CLOSED
  enableDebugLogging: false, // optional
  maxWindowSize: 1000, // optional
  enableRedisFunctions: true, // optional
})
```

### Async Configuration

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisFailureStrategy } from 'nestjs-sliding-window-throttler';

SlidingWindowThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB', 0),
      keyPrefix: configService.get('REDIS_KEY_PREFIX', 'throttle'),
    },
    failureStrategy: configService.get('FAILURE_STRATEGY') === 'fail-closed' 
      ? RedisFailureStrategy.FAIL_CLOSED 
      : RedisFailureStrategy.FAIL_OPEN,
    enableDebugLogging: configService.get('NODE_ENV') === 'development',
    maxWindowSize: configService.get('MAX_WINDOW_SIZE', 1000),
    enableRedisFunctions: configService.get('ENABLE_REDIS_FUNCTIONS', 'true') === 'true',
  }),
})
```

### Environment-Based Configuration

```typescript
import { createConfig, validateConfig } from 'nestjs-sliding-window-throttler';

// Create configuration from environment variables
const config = createConfig(); // Uses process.env by default

// Validate configuration and get warnings
const { isValid, warnings } = validateConfig(config);
if (warnings.length > 0) {
  console.warn('Configuration warnings:', warnings);
}

SlidingWindowThrottlerModule.forRoot(config);
```

## 🔒 Advanced Features

### Block Duration

Configure temporary blocking after rate limit is exceeded:

```typescript
@Throttle({ 
  default: { 
    limit: 10, 
    ttl: 60000, // 1 minute window
    blockDuration: 300000 // Block for 5 minutes after limit exceeded
  } 
})
```

### Failure Strategies

Choose how to handle Redis unavailability using proper enums:

```typescript
import { RedisFailureStrategy } from 'nestjs-sliding-window-throttler';

// Development: Allow requests if Redis is down
SlidingWindowThrottlerModule.forRoot({
  failureStrategy: RedisFailureStrategy.FAIL_OPEN,
  // ... other config
});

// Production: Block requests if Redis is down  
SlidingWindowThrottlerModule.forRoot({
  failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
  // ... other config
});
```

### Custom Logging Integration

Integrate with your observability stack through the logger interface:

```typescript
import { Logger, SlidingWindowThrottlerModule } from 'nestjs-sliding-window-throttler';

// Custom logger for OpenTelemetry integration
class OpenTelemetryLogger implements Logger {
  debug(message: string, context?: Record<string, any>): void {
    // OpenTelemetry debug logging
  }
  
  info(message: string, context?: Record<string, any>): void {
    // OpenTelemetry info logging with span creation
    // Context includes: operation, key, limit, current, remaining, duration
  }
  
  warn(message: string, context?: Record<string, any>): void {
    // OpenTelemetry warning logging
  }
  
  error(message: string, error?: Error, context?: Record<string, any>): void {
    // OpenTelemetry error logging with exception recording
  }
}

// Inject custom logger
@Module({
  providers: [
    {
      provide: 'THROTTLER_LOGGER',
      useClass: OpenTelemetryLogger,
    },
  ],
})
export class AppModule {}
```

### Logger Context Information

The logger receives rich context information for observability:

```typescript
interface LoggerContext {
  operation?: string;        // 'increment', 'reset', etc.
  key?: string;             // Throttling key
  limit?: number;           // Rate limit threshold
  current?: number;         // Current request count
  remaining?: number;       // Remaining requests
  duration?: number;        // Operation duration (ms)
  throttlerName?: string;   // Throttler configuration name
}
```

See the [OpenTelemetry Integration](examples/opentelemetry-integration/) and [Custom Observability](examples/custom-observability/) examples for complete implementations.

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Run integration tests (requires Redis)
npm run test:integration

# Run specific integration tests
npm run test:integration:redis-functions
npm run test:integration:storage
npm run test:integration:cluster
npm run test:integration:stress
```

### End-to-End Tests

```bash
# Run e2e tests
npm run test:e2e

# Run all tests
npm run test:all
npm run test:ci # For CI environments
```

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/orknist/nestjs-sliding-window-throttler.git
cd nestjs-sliding-window-throttler

# Install dependencies
npm install

# Start Redis (required for integration tests)
docker run -d -p 6379:6379 redis:7-alpine

# Or use Valkey as an alternative
docker run -d -p 6379:6379 valkey/valkey:7-alpine

# Run tests
npm test
```

### Build

```bash
# Build the package
npm run build

# Build in watch mode
npm run build:watch

# Clean build artifacts
npm run clean
```

### Code Quality

```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Clean cache
npm run clean:cache
```

## 📚 Documentation

- **[Configuration Guide](docs/configuration.md)** - Configuration options and environment variables
- **[API Documentation](docs/api.md)** - TypeScript interfaces and types
- **[Error Handling](docs/error-handling-and-logging.md)** - Error handling and logging
- **[OpenTelemetry Integration](examples/opentelemetry-integration/)** - Observability with OpenTelemetry
- **[Custom Observability](examples/custom-observability/)** - Custom logging and metrics
- **[Examples](examples/)** - Usage examples and best practices

## 🔧 Troubleshooting

### Common Issues

1. **Redis connection failed**
   ```bash
   # Check Redis connectivity
   redis-cli ping
   
   # Verify configuration
   REDIS_HOST=localhost REDIS_PORT=6379 npm test
   ```

2. **Redis Functions not supported**
   ```bash
   # Check Redis version
   redis-cli INFO server | grep redis_version
   
   # Disable Redis Functions for older versions
   ENABLE_REDIS_FUNCTIONS=false
   ```

3. **Configuration errors**
   ```bash
   # Enable debug logging to see configuration issues
   ENABLE_DEBUG_LOGGING=true
   
   # Validate configuration
   import { createConfig, validateConfig } from 'nestjs-sliding-window-throttler';
   const config = createConfig();
   const { warnings } = validateConfig(config);
   ```

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug
npm start
```

## 🚀 Performance

### Benchmarks

| Feature | Default Throttler | Sliding Window Throttler |
|---------|------------------|-------------------------|
| Accuracy | ~70% (fixed window) | ~99% (sliding window) |
| Memory Usage | Low | Optimized |
| Redis Ops | 2-3 per request | 1 per request |
| Latency | ~2ms | ~1ms |

### Production Tips

1. **Use Redis 7.0+** for Redis Functions support (automatic fallback to Lua scripts)
2. **Configure appropriate window sizes** based on your traffic patterns
3. **Use fail-closed strategy** in production for security
4. **Integrate custom logging** for observability and monitoring
5. **Monitor Redis memory usage** and configure appropriate TTLs

## 🧪 Testing

This project follows a comprehensive testing strategy with three types of tests:

### Test Structure
```
tests/
├── unit/                    # Unit tests (isolated, mocked dependencies)
├── integration/             # Integration tests (real Redis, Docker)
├── e2e/                    # End-to-end tests (full application)
└── helpers/                # Shared test utilities
```

### Running Tests

```bash
# Unit tests (fast, isolated)
npm test
npm run test:unit

# Integration tests (with Redis)
npm run test:integration

# E2E tests (full application)
npm run test:e2e

# All tests
npm run test:all

# Coverage reports
npm run test:coverage              # Combined coverage from all test types (recommended)
npm run test:coverage:unit         # Unit tests coverage only
npm run test:coverage:integration  # Integration tests coverage only
npm run test:coverage:e2e          # E2E tests coverage only

# Watch mode
npm run test:watch
```

### Test Requirements

- **Unit Tests**: Mock all dependencies, no external services
- **Integration Tests**: Use `createTestEnvironment()` helper with Docker Redis
- **E2E Tests**: Use external Redis, test full application stack

For detailed testing guidelines, see [tests/README.md](tests/README.md).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm run test:all`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the NestJS ecosystem
- Inspired by the need for precise rate limiting in production applications
- Uses modern Redis Functions for optimal performance
- Thanks to all contributors and the NestJS community

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/orknist/nestjs-sliding-window-throttler/issues)
- 💬 [Discussions](https://github.com/orknist/nestjs-sliding-window-throttler/discussions)
- 📧 [Email Support](mailto:orkun@email.com)

---

**Made with ❤️ for the NestJS community**