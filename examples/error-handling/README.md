# Custom Error Handling and Logging Example

This example demonstrates comprehensive error handling and logging capabilities of the `nestjs-sliding-window-throttler` package, including custom error strategies, structured logging, and monitoring.

## Overview

The sliding window throttler provides advanced error handling features:

- **Structured Error Types**: Specific error classes for different failure scenarios
- **Recovery Strategies**: Automatic error recovery with fallback mechanisms
- **Comprehensive Logging**: Performance, security, and operational logging
- **Monitoring Integration**: Metrics and health monitoring
- **Custom Error Handlers**: Extensible error handling system

## Error Types and Handling

### 1. Built-in Error Types

```typescript
import {
  ThrottlerError,
  RedisConnectionError,
  RedisFunctionError,
  SecurityViolationError,
  ConfigurationError,
  isThrottlerError,
  isRecoverableError,
} from 'nestjs-sliding-window-throttler';

// Check error types
if (isThrottlerError(error)) {
  console.log('Throttler-specific error:', error.code);
  console.log('Recovery suggestion:', error.getRecoverySuggestion());
}

if (isRecoverableError(error)) {
  console.log('Error can be recovered automatically');
}
```

### 2. Error Recovery Strategies

```typescript
import { ErrorRecoveryManager, RecoveryStrategy } from 'nestjs-sliding-window-throttler';

// Custom recovery strategy
class CustomRecoveryStrategy implements RecoveryStrategy {
  name = 'custom-fallback';
  
  canRecover(error: ThrottlerError): boolean {
    return error instanceof RedisConnectionError;
  }
  
  async recover(error: ThrottlerError, context: any): Promise<any> {
    // Implement custom recovery logic
    console.log('Attempting custom recovery for:', error.message);
    
    // Return fallback result
    return {
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: -1,
    };
  }
}

// Use recovery manager
const recoveryManager = new ErrorRecoveryManager();
recoveryManager.addStrategy(new CustomRecoveryStrategy());

try {
  // Throttler operation
} catch (error) {
  if (isRecoverableError(error)) {
    const result = await recoveryManager.recover(error, context);
    // Use recovered result
  }
}
```

## Logging Configuration

### 1. Logger Setup

```typescript
import { 
  LoggerFactory, 
  ThrottlerLogger, 
  LogLevel,
  SecurityEventType,
  SecurityEventSeverity 
} from 'nestjs-sliding-window-throttler';

// Create logger with custom configuration
const logger = LoggerFactory.create('MyService', {
  level: LogLevel.DEBUG,
  console: true,
  json: false,
  performance: true,
  security: true,
  formatters: {
    console: (entry) => {
      const timestamp = entry.timestamp.toISOString();
      const level = entry.level.toUpperCase().padEnd(8);
      const logger = entry.logger.padEnd(25);
      
      let message = `🚀 [${timestamp}] ${level} ${logger} ${entry.message}`;
      
      if (entry.context) {
        message += `\n   📊 Context: ${JSON.stringify(entry.context, null, 2)}`;
      }
      
      if (entry.error) {
        message += `\n   ❌ Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          message += `\n   📋 Stack: ${entry.error.stack}`;
        }
      }
      
      if (entry.security) {
        message += `\n   🔒 Security: ${entry.security.eventType} (${entry.security.severity})`;
      }
      
      if (entry.performance) {
        message += `\n   ⚡ Performance: ${entry.performance.duration}ms`;
      }
      
      return message;
    },
    json: (entry) => {
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        logger: entry.logger,
        message: entry.message,
        ...entry.context && { context: entry.context },
        ...entry.error && { 
          error: {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          }
        },
        ...entry.security && { security: entry.security },
        ...entry.performance && { performance: entry.performance },
      });
    },
  },
});
```

### 2. Structured Logging Examples

```typescript
// Basic logging
logger.info('Operation started', { userId: 'user123', operation: 'rate-check' });
logger.debug('Debug information', { requestId: 'req-456', details: { limit: 10, current: 5 } });
logger.warn('Warning condition', { threshold: 0.8, current: 0.85 });

// Error logging with context
try {
  // Some operation
} catch (error) {
  logger.error('Operation failed', error, {
    userId: 'user123',
    operation: 'rate-check',
    retryAttempt: 3,
    context: { limit: 10, current: 15 },
  });
}

// Security event logging
logger.security(
  SecurityEventType.RATE_LIMIT_EXCEEDED,
  'Suspicious rate limiting pattern detected',
  SecurityEventSeverity.HIGH,
  {
    clientId: 'client-123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    rateLimit: {
      key: 'user:client-123',
      limit: 10,
      current: 25,
      resetTime: 60,
      throttlerName: 'api-throttler',
    },
    pattern: {
      requestsInBurst: 25,
      timeWindow: 5000,
      suspiciousActivity: true,
    },
  }
);

// Performance monitoring
const endTiming = logger.startTiming('database-query');
try {
  // Database operation
  const result = await database.query('SELECT * FROM users');
  endTiming({ 
    success: true, 
    rowCount: result.length,
    cacheHit: false,
  });
} catch (error) {
  endTiming({ 
    success: false, 
    error: error.message,
  });
  throw error;
}
```

## Custom Error Handler Service

### 1. Comprehensive Error Handler

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerError,
  RedisConnectionError,
  SecurityViolationError,
  ThrottlerLogger,
  LoggerFactory,
  ErrorRecoveryManager,
  isThrottlerError,
  isRecoverableError,
} from 'nestjs-sliding-window-throttler';

@Injectable()
export class CustomErrorHandlerService {
  private readonly logger: ThrottlerLogger;
  private readonly errorRecoveryManager: ErrorRecoveryManager;
  private readonly nestLogger = new Logger(CustomErrorHandlerService.name);

  constructor() {
    this.logger = LoggerFactory.create('ErrorHandler', {
      level: LogLevel.DEBUG,
      console: true,
      performance: true,
      security: true,
    });

    this.errorRecoveryManager = new ErrorRecoveryManager();
    this.setupRecoveryStrategies();
  }

  private setupRecoveryStrategies(): void {
    // Add custom recovery strategies
    this.errorRecoveryManager.addStrategy({
      name: 'redis-fallback',
      canRecover: (error) => error instanceof RedisConnectionError,
      recover: async (error, context) => {
        this.logger.warn('Using Redis fallback strategy', {
          error: error.message,
          strategy: 'redis-fallback',
        });
        
        // Return fail-open result
        return {
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: -1,
        };
      },
    });

    this.errorRecoveryManager.addStrategy({
      name: 'security-lockdown',
      canRecover: (error) => error instanceof SecurityViolationError,
      recover: async (error, context) => {
        this.logger.error('Security violation detected, applying lockdown', {
          error: error.message,
          violationType: error.violationType,
          strategy: 'security-lockdown',
        });
        
        // Return fail-closed result
        return {
          totalHits: 999999,
          timeToExpire: 60,
          isBlocked: true,
          timeToBlockExpire: 3600, // 1 hour block
        };
      },
    });
  }

  async handleError(error: unknown, context?: any): Promise<any> {
    // Log the error with full context
    this.logError(error, context);

    // Handle throttler-specific errors
    if (isThrottlerError(error)) {
      return this.handleThrottlerError(error, context);
    }

    // Handle other errors
    return this.handleGenericError(error, context);
  }

  private async handleThrottlerError(error: ThrottlerError, context?: any): Promise<any> {
    this.logger.error('Throttler error occurred', error, {
      errorCode: error.code,
      severity: error.severity,
      isRecoverable: error.isRecoverable,
      context: error.context,
      recoverySuggestion: error.getRecoverySuggestion(),
    });

    // Log security violations separately
    if (error instanceof SecurityViolationError) {
      this.logger.security(
        SecurityEventType.SUSPICIOUS_PATTERN,
        `Security violation: ${error.violationType}`,
        SecurityEventSeverity.HIGH,
        {
          violationType: error.violationType,
          errorMessage: error.message,
          metadata: error.context,
          clientId: context?.clientId,
          ipAddress: context?.ipAddress,
        }
      );
    }

    // Attempt recovery if possible
    if (isRecoverableError(error)) {
      try {
        this.logger.info('Attempting error recovery', {
          errorCode: error.code,
          availableStrategies: this.errorRecoveryManager
            .getAvailableStrategies(error)
            .map(s => s.name),
        });

        const recoveryResult = await this.errorRecoveryManager.recover(error, context);
        
        this.logger.info('Error recovery successful', {
          strategy: recoveryResult.strategy,
          recovered: recoveryResult.recovered,
          degraded: recoveryResult.degraded,
        });

        return recoveryResult;
      } catch (recoveryError) {
        this.logger.error('Error recovery failed', recoveryError, {
          originalError: error.code,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        });
      }
    }

    // Re-throw if no recovery possible
    throw error;
  }

  private async handleGenericError(error: unknown, context?: any): Promise<any> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.logger.error('Non-throttler error occurred', error instanceof Error ? error : new Error(errorMessage), {
      context,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    // Apply default error handling strategy
    if (context?.failureStrategy === 'fail-open') {
      this.logger.warn('Applying fail-open strategy for generic error');
      return {
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: -1,
      };
    } else {
      this.logger.warn('Applying fail-closed strategy for generic error');
      throw error;
    }
  }

  private logError(error: unknown, context?: any): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : { message: String(error) },
      context,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
    };

    // Log to external monitoring service (e.g., Sentry, DataDog)
    this.logToExternalService(errorInfo);

    // Log to application logs
    this.nestLogger.error('Error handled by CustomErrorHandlerService', JSON.stringify(errorInfo, null, 2));
  }

  private logToExternalService(errorInfo: any): void {
    // Example: Send to external monitoring service
    // Sentry.captureException(errorInfo.error, { extra: errorInfo.context });
    // DataDog.increment('throttler.errors', 1, { error_type: errorInfo.error.name });
    
    console.log('📡 Would send to external monitoring:', {
      service: 'external-monitoring',
      errorType: errorInfo.error.name,
      timestamp: errorInfo.timestamp,
    });
  }

  getMetrics(): any {
    return {
      performance: this.logger.getPerformanceMetrics(),
      recentLogs: this.logger.getRecentLogs(10),
      recoveryStrategies: this.errorRecoveryManager.getAvailableStrategies().map(s => s.name),
    };
  }
}
```

### 2. Global Exception Filter

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import {
  ThrottlerError,
  RedisConnectionError,
  SecurityViolationError,
  isThrottlerError,
} from 'nestjs-sliding-window-throttler';
import { CustomErrorHandlerService } from './custom-error-handler.service';

@Catch()
export class ThrottlerExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorHandler: CustomErrorHandlerService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = {};

    try {
      // Handle throttler exceptions
      if (exception instanceof ThrottlerException) {
        status = HttpStatus.TOO_MANY_REQUESTS;
        message = 'Rate limit exceeded';
        code = 'RATE_LIMIT_EXCEEDED';
        
        // Get retry-after header if available
        const retryAfter = this.extractRetryAfter(exception);
        if (retryAfter) {
          response.setHeader('Retry-After', retryAfter);
          details.retryAfter = retryAfter;
        }
      }
      // Handle custom throttler errors
      else if (isThrottlerError(exception)) {
        const throttlerError = exception as ThrottlerError;
        
        if (throttlerError instanceof SecurityViolationError) {
          status = HttpStatus.FORBIDDEN;
          message = 'Security violation detected';
          code = 'SECURITY_VIOLATION';
          details.violationType = throttlerError.violationType;
        } else if (throttlerError instanceof RedisConnectionError) {
          status = HttpStatus.SERVICE_UNAVAILABLE;
          message = 'Service temporarily unavailable';
          code = 'SERVICE_UNAVAILABLE';
        } else {
          status = HttpStatus.TOO_MANY_REQUESTS;
          message = throttlerError.message;
          code = throttlerError.code;
        }
        
        details.recoverySuggestion = throttlerError.getRecoverySuggestion();
      }
      // Handle other HTTP exceptions
      else if (exception instanceof Error && 'getStatus' in exception) {
        status = (exception as any).getStatus();
        message = exception.message;
      }

      // Attempt error recovery
      const context = {
        request: {
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.get('user-agent'),
        },
        clientId: this.extractClientId(request),
        failureStrategy: process.env.FAILURE_STRATEGY || 'fail-closed',
      };

      const recoveryResult = await this.errorHandler.handleError(exception, context);
      
      if (recoveryResult?.recovered) {
        // If recovery was successful, modify the response
        status = HttpStatus.OK;
        message = 'Request processed with degraded service';
        code = 'DEGRADED_SERVICE';
        details.recovered = true;
        details.degraded = recoveryResult.degraded;
      }

    } catch (handlingError) {
      // Error in error handling - log and use defaults
      console.error('Error in exception filter:', handlingError);
    }

    // Send error response
    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...details,
      },
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          stack: exception instanceof Error ? exception.stack : undefined,
          originalError: exception instanceof Error ? exception.message : String(exception),
        },
      }),
    };

    response.status(status).json(errorResponse);
  }

  private extractRetryAfter(exception: ThrottlerException): number | undefined {
    // Extract retry-after information from throttler exception
    // This would depend on the specific implementation
    return undefined;
  }

  private extractClientId(request: any): string {
    return request.user?.id || request.ip || 'anonymous';
  }
}
```

## Monitoring and Alerting

### 1. Health Check Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';
import { CustomErrorHandlerService } from './custom-error-handler.service';

@Injectable()
export class ThrottlerHealthService {
  private readonly logger = new Logger(ThrottlerHealthService.name);
  
  constructor(
    private readonly throttlerStorage: SlidingWindowThrottlerStorage,
    private readonly errorHandler: CustomErrorHandlerService,
  ) {}
  
  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthCheck(): Promise<void> {
    try {
      const metrics = await this.getHealthMetrics();
      
      this.logger.log('Throttler health check completed', {
        status: metrics.status,
        redisConnected: metrics.redis.connected,
        errorRate: metrics.performance.errorRate,
        averageLatency: metrics.performance.averageLatency,
      });
      
      // Check for alerts
      await this.checkAlerts(metrics);
      
    } catch (error) {
      this.logger.error('Health check failed', error);
      await this.errorHandler.handleError(error, { source: 'health-check' });
    }
  }
  
  async getHealthMetrics(): Promise<any> {
    const storageMetrics = await this.throttlerStorage.getMetrics();
    const errorHandlerMetrics = this.errorHandler.getMetrics();
    
    return {
      status: storageMetrics.redis.connected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: {
        connected: storageMetrics.redis.connected,
        cluster: storageMetrics.redis.cluster,
        memory: storageMetrics.redis.memory,
        keyCount: storageMetrics.redis.keyCount,
        lastError: storageMetrics.redis.lastError,
      },
      performance: {
        totalRequests: storageMetrics.performance.totalRequests,
        requestsPerSecond: storageMetrics.performance.requestsPerSecond,
        averageLatency: storageMetrics.performance.averageLatency,
        p95Latency: storageMetrics.performance.p95Latency,
        errorRate: storageMetrics.performance.errorRate,
      },
      throttling: {
        activeWindows: storageMetrics.throttling.activeWindows,
        blockedClients: storageMetrics.throttling.blockedClients,
        topClients: storageMetrics.throttling.topClients,
      },
      errorHandling: {
        recentErrors: errorHandlerMetrics.recentLogs.filter(log => log.level === 'error').length,
        recoveryStrategies: errorHandlerMetrics.recoveryStrategies,
        performanceMetrics: errorHandlerMetrics.performance,
      },
    };
  }
  
  private async checkAlerts(metrics: any): Promise<void> {
    const alerts: Array<{ level: string; message: string; metric: string; value: any }> = [];
    
    // Redis connection alert
    if (!metrics.redis.connected) {
      alerts.push({
        level: 'critical',
        message: 'Redis connection lost',
        metric: 'redis.connected',
        value: false,
      });
    }
    
    // High error rate alert
    if (metrics.performance.errorRate > 0.05) { // 5%
      alerts.push({
        level: 'warning',
        message: `High error rate: ${(metrics.performance.errorRate * 100).toFixed(2)}%`,
        metric: 'performance.errorRate',
        value: metrics.performance.errorRate,
      });
    }
    
    // High latency alert
    if (metrics.performance.p95Latency > 1000) { // 1 second
      alerts.push({
        level: 'warning',
        message: `High P95 latency: ${metrics.performance.p95Latency}ms`,
        metric: 'performance.p95Latency',
        value: metrics.performance.p95Latency,
      });
    }
    
    // Too many blocked clients
    if (metrics.throttling.blockedClients > 100) {
      alerts.push({
        level: 'warning',
        message: `High number of blocked clients: ${metrics.throttling.blockedClients}`,
        metric: 'throttling.blockedClients',
        value: metrics.throttling.blockedClients,
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }
  
  private async sendAlert(alert: any): Promise<void> {
    this.logger.warn('Throttler alert triggered', alert);
    
    // Send to external alerting system
    // await this.alertingService.send(alert);
    
    // Example: Send to Slack, PagerDuty, etc.
    console.log('🚨 ALERT:', alert);
  }
}
```

### 2. Metrics Collection

```typescript
import { Injectable } from '@nestjs/common';
import { PrometheusService } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class ThrottlerMetricsService {
  private readonly requestCounter: Counter<string>;
  private readonly latencyHistogram: Histogram<string>;
  private readonly errorCounter: Counter<string>;
  private readonly blockedClientsGauge: Gauge<string>;
  
  constructor(private readonly prometheus: PrometheusService) {
    this.requestCounter = this.prometheus.getCounter({
      name: 'throttler_requests_total',
      help: 'Total number of throttler requests',
      labelNames: ['throttler', 'allowed', 'client_type'],
    });
    
    this.latencyHistogram = this.prometheus.getHistogram({
      name: 'throttler_request_duration_seconds',
      help: 'Throttler request duration in seconds',
      labelNames: ['throttler', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });
    
    this.errorCounter = this.prometheus.getCounter({
      name: 'throttler_errors_total',
      help: 'Total number of throttler errors',
      labelNames: ['error_type', 'recoverable', 'strategy'],
    });
    
    this.blockedClientsGauge = this.prometheus.getGauge({
      name: 'throttler_blocked_clients',
      help: 'Number of currently blocked clients',
      labelNames: ['throttler'],
    });
  }
  
  recordRequest(throttlerName: string, allowed: boolean, clientType: string, latency: number): void {
    this.requestCounter
      .labels({ throttler: throttlerName, allowed: allowed.toString(), client_type: clientType })
      .inc();
    
    this.latencyHistogram
      .labels({ throttler: throttlerName, operation: 'check' })
      .observe(latency / 1000);
  }
  
  recordError(errorType: string, recoverable: boolean, strategy?: string): void {
    this.errorCounter
      .labels({ 
        error_type: errorType, 
        recoverable: recoverable.toString(),
        strategy: strategy || 'none',
      })
      .inc();
  }
  
  updateBlockedClients(throttlerName: string, count: number): void {
    this.blockedClientsGauge
      .labels({ throttler: throttlerName })
      .set(count);
  }
}
```

## Testing Error Handling

### 1. Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CustomErrorHandlerService } from './custom-error-handler.service';
import { 
  RedisConnectionError, 
  SecurityViolationError,
  ThrottlerError 
} from 'nestjs-sliding-window-throttler';

describe('CustomErrorHandlerService', () => {
  let service: CustomErrorHandlerService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomErrorHandlerService],
    }).compile();
    
    service = module.get<CustomErrorHandlerService>(CustomErrorHandlerService);
  });
  
  describe('handleError', () => {
    it('should handle Redis connection errors with recovery', async () => {
      const error = new RedisConnectionError('Connection failed', new Error('ECONNREFUSED'));
      
      const result = await service.handleError(error, { failureStrategy: 'fail-open' });
      
      expect(result).toBeDefined();
      expect(result.recovered).toBe(true);
      expect(result.isBlocked).toBe(false);
    });
    
    it('should handle security violations with lockdown', async () => {
      const error = new SecurityViolationError('Suspicious pattern detected', 'rate_abuse');
      
      const result = await service.handleError(error, { clientId: 'suspicious-client' });
      
      expect(result).toBeDefined();
      expect(result.recovered).toBe(true);
      expect(result.isBlocked).toBe(true);
    });
    
    it('should re-throw non-recoverable errors', async () => {
      const error = new ThrottlerError('Non-recoverable error', 'TEST_ERROR', false);
      
      await expect(service.handleError(error)).rejects.toThrow('Non-recoverable error');
    });
  });
});
```

### 2. Integration Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Error Handling Integration', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('Redis Connection Failures', () => {
    it('should handle Redis connection failure gracefully', async () => {
      // Simulate Redis failure by stopping Redis or using invalid config
      
      const response = await request(app.getHttpServer())
        .get('/api/data')
        .expect((res) => {
          // Should either succeed with degraded service or fail gracefully
          expect([200, 503]).toContain(res.status);
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('recovered', true);
      }
    });
  });
  
  describe('Security Violations', () => {
    it('should detect and handle suspicious patterns', async () => {
      const clientId = 'suspicious-client-' + Date.now();
      
      // Make many requests quickly to trigger security detection
      const requests = Array(50).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/data')
          .set('X-Forwarded-For', clientId)
      );
      
      const responses = await Promise.all(requests);
      
      // Should eventually block or return security violation
      const blockedResponses = responses.filter(r => r.status === 403 || r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });
});
```

## Environment Configuration

```bash
# .env - Error Handling Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Error Handling Strategy
FAILURE_STRATEGY=fail-open                    # fail-open, fail-closed
ENABLE_ERROR_RECOVERY=true
ENABLE_SECURITY_MONITORING=true

# Logging Configuration
LOG_LEVEL=debug                               # debug, info, warn, error
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_SECURITY_LOGGING=true
ENABLE_JSON_LOGGING=false                     # Use JSON format for production

# Monitoring and Alerting
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=60000                   # 1 minute
ALERT_ERROR_RATE_THRESHOLD=0.05              # 5%
ALERT_LATENCY_THRESHOLD=1000                 # 1 second
ALERT_BLOCKED_CLIENTS_THRESHOLD=100

# External Services
SENTRY_DSN=your-sentry-dsn                   # Error tracking
DATADOG_API_KEY=your-datadog-key             # Metrics
SLACK_WEBHOOK_URL=your-slack-webhook         # Alerts
```

## Best Practices

### 1. Error Handling Guidelines

- **Fail Fast**: Detect and handle errors as early as possible
- **Graceful Degradation**: Provide fallback functionality when possible
- **Structured Logging**: Use consistent log formats with context
- **Recovery Strategies**: Implement automatic recovery for transient failures
- **Monitoring**: Track error rates and patterns for proactive maintenance

### 2. Security Considerations

- **Mask Sensitive Data**: Never log passwords, tokens, or PII
- **Rate Limit Logs**: Prevent log flooding from repeated errors
- **Security Events**: Log all security-related events separately
- **Audit Trail**: Maintain audit logs for compliance requirements

### 3. Performance Optimization

- **Async Logging**: Use asynchronous logging to avoid blocking
- **Log Levels**: Use appropriate log levels to control verbosity
- **Sampling**: Sample high-frequency logs to reduce overhead
- **Buffering**: Buffer logs for batch processing when possible

This comprehensive error handling and logging system provides robust protection against failures while maintaining observability and enabling quick recovery from issues.