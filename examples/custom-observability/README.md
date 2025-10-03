# Custom Observability Integration

This example demonstrates how to implement custom observability for the sliding window throttler using the logger interface.

## Features

- Custom metrics collection
- Structured logging with context
- Error tracking and alerting
- Performance monitoring
- Integration with popular observability platforms

## Supported Platforms

- **Prometheus + Grafana**: Metrics collection and visualization
- **DataDog**: APM and logging integration  
- **New Relic**: Performance monitoring
- **Elastic Stack**: Log aggregation and analysis
- **Custom solutions**: Flexible logger interface

## Usage

The logger interface provides hooks for all throttling operations:

```typescript
interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
}
```

### Context Information

The throttler provides rich context information:

- `operation`: Type of operation (increment, reset, etc.)
- `key`: Throttling key being processed
- `limit`: Rate limit threshold
- `current`: Current request count
- `remaining`: Remaining requests in window
- `duration`: Operation duration in milliseconds
- `throttlerName`: Name of the throttler configuration

See the implementations below for specific platform integrations.