/**
 * @fileoverview OpenTelemetry logger implementation for throttler observability
 * 
 * This logger integrates with OpenTelemetry to provide comprehensive observability
 * for throttling operations including spans, metrics, and error tracking.
 */

import { Logger } from 'nestjs-sliding-window-throttler';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

/**
 * OpenTelemetry-compatible logger for throttler operations
 */
export class OpenTelemetryThrottlerLogger implements Logger {
  private readonly tracer = trace.getTracer('nestjs-sliding-window-throttler', '1.0.0');

  debug(message: string, ctx?: Record<string, any>): void {
    // Only create spans for debug in development
    if (process.env.NODE_ENV === 'development') {
      const span = this.tracer.startSpan('throttler.debug', {
        kind: SpanKind.INTERNAL,
        attributes: {
          'throttler.level': 'debug',
          'throttler.message': message,
          ...this.flattenContext(ctx),
        },
      });
      span.end();
    }
  }

  info(message: string, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.operation', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'throttler.level': 'info',
        'throttler.message': message,
        'throttler.operation': ctx?.operation || 'unknown',
        ...this.flattenContext(ctx),
      },
    });

    // Add operation-specific attributes
    if (ctx?.key) {
      span.setAttributes({ 'throttler.key': ctx.key });
    }
    
    if (ctx?.duration) {
      span.setAttributes({ 'throttler.duration_ms': ctx.duration });
    }

    if (ctx?.limit) {
      span.setAttributes({ 'throttler.limit': ctx.limit });
    }

    if (ctx?.current) {
      span.setAttributes({ 'throttler.current_count': ctx.current });
    }

    if (ctx?.remaining) {
      span.setAttributes({ 'throttler.remaining': ctx.remaining });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  warn(message: string, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.warning', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'throttler.level': 'warn',
        'throttler.message': message,
        ...this.flattenContext(ctx),
      },
    });
    
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
  }

  error(message: string, error?: Error, ctx?: Record<string, any>): void {
    const span = this.tracer.startSpan('throttler.error', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'throttler.level': 'error',
        'throttler.message': message,
        ...this.flattenContext(ctx),
      },
    });

    // Add error details
    if (error) {
      span.setAttributes({
        'throttler.error.name': error.name,
        'throttler.error.message': error.message,
      });
      
      // Record the exception for detailed error tracking
      span.recordException(error);
    }
    
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error?.message || message 
    });
    span.end();
  }

  /**
   * Flatten context object for OpenTelemetry attributes
   * OpenTelemetry attributes must be primitive types
   */
  private flattenContext(ctx?: Record<string, any>): Record<string, string | number | boolean> {
    if (!ctx) return {};
    
    const flattened: Record<string, string | number | boolean> = {};
    
    for (const [key, value] of Object.entries(ctx)) {
      // Skip undefined and null values
      if (value === undefined || value === null) {
        continue;
      }
      
      // Handle primitive types directly
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flattened[`throttler.${key}`] = value;
      } else {
        // Convert complex types to strings
        try {
          flattened[`throttler.${key}`] = JSON.stringify(value);
        } catch {
          flattened[`throttler.${key}`] = String(value);
        }
      }
    }
    
    return flattened;
  }
}

/**
 * Factory for creating OpenTelemetry logger instances
 */
export class OpenTelemetryLoggerFactory {
  createLogger(name: string): Logger {
    return new OpenTelemetryThrottlerLogger();
  }
}