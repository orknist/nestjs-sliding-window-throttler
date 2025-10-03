# Logger Interface Documentation

The sliding window throttler provides a flexible logger interface that allows you to integrate with any logging or observability system.

## Logger Interface

```typescript
interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
}
```

## Context Information

The throttler provides rich context information for observability:

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

## Built-in Logger

The package includes a simple console logger for development:

```typescript
import { ConsoleLogger } from 'nestjs-sliding-window-throttler';

const logger = new ConsoleLogger();
```

## Custom Logger Examples

### 1. Structured JSON Logger

```typescript
import { Logger } from 'nestjs-sliding-window-throttler';

export class StructuredLogger implements Logger {
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, { ...context, error: error?.message });
  }

  private log(level: string, message: string, context?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'throttler',
      ...context,
    };
    
    console.log(JSON.stringify(logEntry));
  }
}
```

### 2. Winston Logger Integration

```typescript
import { Logger } from 'nestjs-sliding-window-throttler';
import * as winston from 'winston';

export class WinstonThrottlerLogger implements Logger {
  private readonly winston: winston.Logger;

  constructor() {
    this.winston = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'throttler.log' })
      ],
    });
  }

  debug(message: string, context?: Record<string, any>): void {
    this.winston.debug(message, { service: 'throttler', ...context });
  }

  info(message: string, context?: Record<string, any>): void {
    this.winston.info(message, { service: 'throttler', ...context });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.winston.warn(message, { service: 'throttler', ...context });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.winston.error(message, { 
      service: 'throttler', 
      error: error?.message,
      stack: error?.stack,
      ...context 
    });
  }
}
```

### 3. Pino Logger Integration

```typescript
import { Logger } from 'nestjs-sliding-window-throttler';
import pino from 'pino';

export class PinoThrottlerLogger implements Logger {
  private readonly pino: pino.Logger;

  constructor() {
    this.pino = pino({
      name: 'throttler',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  debug(message: string, context?: Record<string, any>): void {
    this.pino.debug(context, message);
  }

  info(message: string, context?: Record<string, any>): void {
    this.pino.info(context, message);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.pino.warn(context, message);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.pino.error({ err: error, ...context }, message);
  }
}
```

## Integration with NestJS

### Method 1: Provider Injection

```typescript
import { Module } from '@nestjs/common';
import { SlidingWindowThrottlerModule } from 'nestjs-sliding-window-throttler';
import { WinstonThrottlerLogger } from './winston-logger';

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      redis: { host: 'localhost', port: 6379 },
      failureStrategy: FailureStrategy.FAIL_OPEN,
    }),
  ],
  providers: [
    {
      provide: 'THROTTLER_LOGGER',
      useClass: WinstonThrottlerLogger,
    },
  ],
})
export class AppModule {}
```

### Method 2: Factory Function

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    {
      provide: 'THROTTLER_LOGGER',
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get('LOG_LEVEL', 'info');
        return new StructuredLogger(logLevel);
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

## Logger Factory Pattern

For more complex scenarios, you can implement a logger factory:

```typescript
import { Logger, LoggerFactory } from 'nestjs-sliding-window-throttler';

export class CustomLoggerFactory implements LoggerFactory {
  createLogger(name: string): Logger {
    switch (process.env.LOGGER_TYPE) {
      case 'winston':
        return new WinstonThrottlerLogger();
      case 'pino':
        return new PinoThrottlerLogger();
      case 'structured':
        return new StructuredLogger();
      default:
        return new ConsoleLogger();
    }
  }
}
```

## Best Practices

### 1. Performance Considerations

- Avoid expensive operations in logger methods
- Use async logging for high-throughput scenarios
- Consider log level filtering

```typescript
export class PerformantLogger implements Logger {
  private readonly isDebugEnabled = process.env.LOG_LEVEL === 'debug';

  debug(message: string, context?: Record<string, any>): void {
    if (!this.isDebugEnabled) return;
    // Only process debug logs when needed
    this.log('debug', message, context);
  }

  // ... other methods
}
```

### 2. Error Handling

- Always handle logger errors gracefully
- Don't let logging failures affect throttling

```typescript
export class SafeLogger implements Logger {
  private fallbackToConsole(level: string, message: string, data?: any): void {
    console[level](`[THROTTLER] ${message}`, data);
  }

  info(message: string, context?: Record<string, any>): void {
    try {
      // Your logging logic
      this.externalLogger.info(message, context);
    } catch (error) {
      this.fallbackToConsole('info', message, context);
    }
  }

  // ... other methods with similar error handling
}
```

### 3. Context Enrichment

- Add consistent metadata to all log entries
- Include correlation IDs for request tracing

```typescript
export class EnrichedLogger implements Logger {
  private enrichContext(context?: Record<string, any>): Record<string, any> {
    return {
      service: 'throttler',
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      ...context,
    };
  }

  info(message: string, context?: Record<string, any>): void {
    const enrichedContext = this.enrichContext(context);
    this.logger.info(message, enrichedContext);
  }

  // ... other methods
}
```

## Testing Logger Implementations

```typescript
import { Logger } from 'nestjs-sliding-window-throttler';

describe('CustomLogger', () => {
  let logger: Logger;
  let mockTransport: jest.Mock;

  beforeEach(() => {
    mockTransport = jest.fn();
    logger = new CustomLogger(mockTransport);
  });

  it('should log info messages with context', () => {
    const message = 'Test message';
    const context = { operation: 'increment', key: 'test-key' };

    logger.info(message, context);

    expect(mockTransport).toHaveBeenCalledWith('info', message, context);
  });

  it('should handle errors gracefully', () => {
    const error = new Error('Test error');
    
    logger.error('Error occurred', error, { key: 'test' });

    expect(mockTransport).toHaveBeenCalledWith(
      'error',
      'Error occurred',
      expect.objectContaining({
        error: 'Test error',
        key: 'test',
      })
    );
  });
});
```

This logger interface provides the flexibility to integrate with any logging or observability system while maintaining clean separation of concerns.