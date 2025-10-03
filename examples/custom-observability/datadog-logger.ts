/**
 * @fileoverview DataDog APM logger for throttler observability
 */

import { Logger } from 'nestjs-sliding-window-throttler';

// Note: In a real implementation, you would import the DataDog tracer
// import tracer from 'dd-trace';

/**
 * DataDog-compatible logger for throttler APM integration
 */
export class DataDogThrottlerLogger implements Logger {
  private readonly serviceName: string;

  constructor(serviceName = 'throttler-service') {
    this.serviceName = serviceName;
  }

  debug(message: string, context?: Record<string, any>): void {
    // DataDog debug logging with structured data
    this.logWithDataDog('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    // Create DataDog span for operation tracking
    if (context?.operation) {
      this.createDataDogSpan(context.operation, context);
    }

    this.logWithDataDog('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    // Log warning with DataDog tags
    this.logWithDataDog('warn', message, context, {
      'throttler.warning': true,
    });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    // Create error span and log exception
    if (error) {
      this.recordDataDogError(error, context);
    }

    this.logWithDataDog('error', message, context, {
      'throttler.error': true,
      'error.name': error?.name,
      'error.message': error?.message,
    });
  }

  private logWithDataDog(
    level: string,
    message: string,
    context?: Record<string, any>,
    additionalTags?: Record<string, any>
  ): void {
    const logData = {
      level,
      message,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...context,
      ...additionalTags,
    };

    // In a real implementation, you would use DataDog's logging library
    console.log(JSON.stringify(logData));
  }

  private createDataDogSpan(operation: string, context?: Record<string, any>): void {
    // In a real implementation, you would create a DataDog span:
    /*
    const span = tracer.startSpan('throttler.operation', {
      tags: {
        'throttler.operation': operation,
        'throttler.key': context?.key,
        'throttler.limit': context?.limit,
        'throttler.current': context?.current,
        'throttler.remaining': context?.remaining,
        'throttler.name': context?.throttlerName,
        'service.name': this.serviceName,
      },
    });

    if (context?.duration) {
      span.setTag('throttler.duration_ms', context.duration);
    }

    span.finish();
    */

    // Placeholder implementation
    console.log(`[DataDog Span] ${operation}`, {
      operation,
      service: this.serviceName,
      ...context,
    });
  }

  private recordDataDogError(error: Error, context?: Record<string, any>): void {
    // In a real implementation, you would record the error with DataDog:
    /*
    const span = tracer.scope().active();
    if (span) {
      span.setTag('error', true);
      span.setTag('error.type', error.name);
      span.setTag('error.message', error.message);
      span.setTag('error.stack', error.stack);
    }
    */

    // Placeholder implementation
    console.error(`[DataDog Error] ${error.name}: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      service: this.serviceName,
    });
  }
}