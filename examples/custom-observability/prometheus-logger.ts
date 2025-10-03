/**
 * @fileoverview Prometheus metrics logger for throttler observability
 */

import { Logger } from 'nestjs-sliding-window-throttler';
import { register, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Prometheus-compatible logger for throttler metrics collection
 */
export class PrometheusThrottlerLogger implements Logger {
  private readonly requestCounter: Counter<string>;
  private readonly operationDuration: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly errorCounter: Counter<string>;

  constructor() {
    // Initialize Prometheus metrics
    this.requestCounter = new Counter({
      name: 'throttler_requests_total',
      help: 'Total number of throttler requests',
      labelNames: ['operation', 'throttler_name', 'status'],
      registers: [register],
    });

    this.operationDuration = new Histogram({
      name: 'throttler_operation_duration_seconds',
      help: 'Duration of throttler operations',
      labelNames: ['operation', 'throttler_name'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
      registers: [register],
    });

    this.activeConnections = new Gauge({
      name: 'throttler_active_connections',
      help: 'Number of active throttler connections',
      labelNames: ['throttler_name'],
      registers: [register],
    });

    this.errorCounter = new Counter({
      name: 'throttler_errors_total',
      help: 'Total number of throttler errors',
      labelNames: ['error_type', 'operation'],
      registers: [register],
    });
  }

  debug(message: string, context?: Record<string, any>): void {
    // Debug messages don't generate metrics in production
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[THROTTLER DEBUG] ${message}`, context);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    // Record successful operations
    if (context?.operation) {
      this.requestCounter
        .labels({
          operation: context.operation,
          throttler_name: context.throttlerName || 'default',
          status: 'success',
        })
        .inc();

      // Record operation duration if available
      if (context.duration) {
        this.operationDuration
          .labels({
            operation: context.operation,
            throttler_name: context.throttlerName || 'default',
          })
          .observe(context.duration / 1000); // Convert to seconds
      }

      // Update active connections gauge
      if (context.operation === 'increment' && context.current) {
        this.activeConnections
          .labels({ throttler_name: context.throttlerName || 'default' })
          .set(context.current);
      }
    }

    console.info(`[THROTTLER] ${message}`, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    // Record warnings as potential issues
    this.requestCounter
      .labels({
        operation: context?.operation || 'unknown',
        throttler_name: context?.throttlerName || 'default',
        status: 'warning',
      })
      .inc();

    console.warn(`[THROTTLER WARNING] ${message}`, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    // Record errors for monitoring
    this.errorCounter
      .labels({
        error_type: error?.name || 'UnknownError',
        operation: context?.operation || 'unknown',
      })
      .inc();

    this.requestCounter
      .labels({
        operation: context?.operation || 'unknown',
        throttler_name: context?.throttlerName || 'default',
        status: 'error',
      })
      .inc();

    console.error(`[THROTTLER ERROR] ${message}`, { error, context });
  }

  /**
   * Get Prometheus metrics for /metrics endpoint
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    register.clear();
  }
}