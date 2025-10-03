# OpenTelemetry Integration Example

This example demonstrates how to integrate the sliding window throttler with OpenTelemetry for comprehensive observability.

## Features

- Custom logger implementation for OpenTelemetry
- Automatic span creation for throttling operations
- Error tracking and exception recording
- Metrics collection for rate limiting events
- Structured logging with context propagation

## Setup

### 1. Install Required Dependencies

```bash
# Core throttler package
npm install nestjs-sliding-window-throttler

# OpenTelemetry packages
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/semantic-conventions

# NestJS dependencies
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/throttler

# Redis client
npm install ioredis

# Development dependencies
npm install --save-dev @types/node ts-node typescript
```

### 2. Environment Variables

Create a `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password-here
REDIS_DB=0

# Throttler Configuration
FAILURE_STRATEGY=fail-open
ENABLE_DEBUG_LOGGING=true
MAX_WINDOW_SIZE=1000
ENABLE_REDIS_FUNCTIONS=true
```

## Usage

```typescript
import { Logger } from 'nestjs-sliding-window-throttler';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export class OpenTelemetryThrottlerLogger implements Logger {
  private readonly tracer = trace.getTracer('throttler');

  debug(message: string, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.debug');
    span.setAttributes({
      'throttler.message': message,
      ...this.flattenContext(ctx),
    });
    span.end();
  }

  info(message: string, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.operation');
    span.setAttributes({
      'throttler.message': message,
      'throttler.operation': ctx?.operation || 'unknown',
      'throttler.key': ctx?.key || 'unknown',
      ...this.flattenContext(ctx),
    });
    
    if (ctx?.duration) {
      span.setAttributes({ 'throttler.duration_ms': ctx.duration });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  warn(message: string, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.warning');
    span.setAttributes({
      'throttler.message': message,
      ...this.flattenContext(ctx),
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
  }

  error(message: string, error?: Error, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.error');
    span.setAttributes({
      'throttler.message': message,
      'throttler.error.name': error?.name || 'UnknownError',
      'throttler.error.message': error?.message || message,
      ...this.flattenContext(ctx),
    });
    
    if (error) {
      span.recordException(error);
    }
    
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
  }

  private flattenContext(ctx?: Record<string, any>): Record<string, string | number | boolean> {
    if (!ctx) return {};
    
    const flattened: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(ctx)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flattened[`throttler.${key}`] = value;
      } else if (value !== null && value !== undefined) {
        flattened[`throttler.${key}`] = String(value);
      }
    }
    return flattened;
  }
}
```

## Running the Example

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Install dependencies** (see Setup section above)

3. **Copy the example files** to your NestJS project:
   - `tracing.ts` - OpenTelemetry configuration
   - `opentelemetry-logger.ts` - Custom logger implementation
   - `app.module.ts` - Module configuration
   - `app.controller.ts` - Controller with throttling
   - `main.ts` - Application bootstrap

4. **Start your application:**
   ```bash
   npm run start:dev
   ```

5. **Test the integration:**
   ```bash
   # Make requests to see OpenTelemetry traces
   curl http://localhost:3000/
   curl http://localhost:3000/sensitive
   ```

## Key Integration Points

- **Custom Logger**: `OpenTelemetryThrottlerLogger` creates spans for all throttler operations
- **Tracing**: Automatic span creation with detailed attributes
- **Error Tracking**: Exception recording for Redis failures
- **Metrics**: Custom metrics for rate limiting events
- **Context Propagation**: Maintains trace context across async operations

See the complete implementation in the files below.