/**
 * @fileoverview Example demonstrating comprehensive error handling and logging
 * 
 * This example shows how to use the enhanced error handling and logging
 * features of the nestjs-sliding-window-throttler package.
 */

import { Module, Controller, Get, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  SlidingWindowThrottlerModule,
  SlidingWindowThrottlerStorage,
  ThrottlerLogger,
  LoggerFactory,
  ErrorRecoveryManager,
  ThrottlerError,
  RedisConnectionError,
  SecurityViolationError,
  LogLevel,
  SecurityEventType,
  SecurityEventSeverity,
  isThrottlerError,
  isRecoverableError,
} from 'nestjs-sliding-window-throttler';

// =============================================================================
// CUSTOM ERROR HANDLER SERVICE
// =============================================================================

@Injectable()
export class ErrorHandlerService {
  private readonly logger: ThrottlerLogger;
  private readonly errorRecoveryManager: ErrorRecoveryManager;

  constructor() {
    // Initialize logger with custom configuration
    this.logger = LoggerFactory.create('ErrorHandlerService', {
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
          }
          
          if (entry.security) {
            message += `\n   🔒 Security: ${entry.security.eventType} (${entry.security.severity})`;
          }
          
          return message;
        },
      },
    });

    this.errorRecoveryManager = new ErrorRecoveryManager();
  }

  /**
   * Handle throttler errors with comprehensive logging and recovery
   */
  async handleThrottlerError(error: unknown, context?: any): Promise<any> {
    if (!isThrottlerError(error)) {
      this.logger.error('Non-throttler error occurred', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }

    // Log the error with full context
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
        `Security violation detected: ${error.violationType}`,
        SecurityEventSeverity.HIGH,
        {
          violationType: error.violationType,
          errorMessage: error.message,
          metadata: error.context,
        },
      );
    }

    // Attempt error recovery if the error is recoverable
    if (isRecoverableError(error)) {
      try {
        this.logger.info('Attempting error recovery', {
          errorCode: error.code,
          availableStrategies: this.errorRecoveryManager.getAvailableStrategies(error).map(s => s.name),
        });

        const recoveryResult = await this.errorRecoveryManager.recover(error, context);
        
        this.logger.info('Error recovery successful', {
          strategy: recoveryResult.strategy,
          recovered: recoveryResult.recovered,
          degraded: recoveryResult.degraded,
        });

        return recoveryResult;
      } catch (recoveryError) {
        this.logger.error('Error recovery failed', recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)), {
          originalError: error.code,
        });
      }
    }

    // Re-throw the original error if recovery failed or not applicable
    throw error;
  }

  /**
   * Demonstrate performance monitoring
   */
  async performanceExample(): Promise<void> {
    const endTiming = this.logger.startTiming('example-operation');
    
    try {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      this.logger.info('Operation completed successfully');
      endTiming({ success: true, itemsProcessed: 42 });
    } catch (error) {
      this.logger.error('Operation failed', error instanceof Error ? error : new Error(String(error)));
      endTiming({ success: false, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Demonstrate security event logging
   */
  logSecurityEvent(eventType: SecurityEventType, message: string, clientId?: string): void {
    this.logger.security(eventType, message, SecurityEventSeverity.MEDIUM, {
      clientId,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Example Browser)',
      request: {
        method: 'POST',
        path: '/api/throttled-endpoint',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'example-application',
      },
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      performance: this.logger.getPerformanceMetrics(),
      recentLogs: this.logger.getRecentLogs(10),
    };
  }
}

// =============================================================================
// THROTTLER SERVICE WITH ERROR HANDLING
// =============================================================================

@Injectable()
export class ThrottlerService {
  private readonly logger: ThrottlerLogger;

  constructor(
    private readonly storage: SlidingWindowThrottlerStorage,
    private readonly errorHandler: ErrorHandlerService,
  ) {
    this.logger = LoggerFactory.create('ThrottlerService');
  }

  /**
   * Check rate limit with comprehensive error handling
   */
  async checkRateLimit(
    key: string,
    limit: number = 10,
    windowMs: number = 60000,
    blockDurationMs: number = 30000,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      this.logger.debug('Checking rate limit', {
        key: this.maskKey(key),
        limit,
        windowMs,
        blockDurationMs,
      });

      const result = await this.storage.increment(
        key,
        windowMs,
        limit,
        blockDurationMs,
        'default',
      );

      const allowed = !result.isBlocked && result.totalHits <= limit;
      const remaining = Math.max(0, limit - result.totalHits);

      this.logger.info('Rate limit check completed', {
        key: this.maskKey(key),
        allowed,
        remaining,
        totalHits: result.totalHits,
        isBlocked: result.isBlocked,
      });

      // Log rate limit events
      if (result.isBlocked) {
        this.errorHandler.logSecurityEvent(
          SecurityEventType.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded for key: ${this.maskKey(key)}`,
          key,
        );
      }

      return {
        allowed,
        remaining,
        resetTime: result.timeToExpire,
      };
    } catch (error) {
      // Use error handler for comprehensive error handling
      const recoveryResult = await this.errorHandler.handleThrottlerError(error, {
        redis: this.storage['redis'], // Access private redis client
        functionsManager: this.storage['functionsManager'],
        config: this.storage['config'],
      });

      // If recovery was successful and returned a result, use it
      if (recoveryResult?.recovered && recoveryResult?.result) {
        const result = recoveryResult.result;
        const allowed = !result.isBlocked && result.totalHits <= limit;
        const remaining = Math.max(0, limit - result.totalHits);

        this.logger.warn('Using recovered rate limit result', {
          degraded: recoveryResult.degraded,
          strategy: recoveryResult.strategy,
        });

        return {
          allowed,
          remaining,
          resetTime: result.timeToExpire,
        };
      }

      // If no recovery result, re-throw the error
      throw error;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<void> {
    try {
      this.logger.info('Resetting rate limit', { key: this.maskKey(key) });
      
      await this.storage.reset(key);
      
      this.logger.info('Rate limit reset completed', { key: this.maskKey(key) });
      
      // Log security event for rate limit reset
      this.errorHandler.logSecurityEvent(
        SecurityEventType.RATE_LIMIT_VIOLATION,
        `Rate limit reset for key: ${this.maskKey(key)}`,
        key,
      );
    } catch (error) {
      await this.errorHandler.handleThrottlerError(error);
    }
  }

  /**
   * Get health and performance metrics
   */
  async getMetrics(): Promise<any> {
    try {
      const storageMetrics = await this.storage.getMetrics();
      const errorHandlerMetrics = this.errorHandler.getMetrics();

      return {
        storage: storageMetrics,
        errorHandler: errorHandlerMetrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private maskKey(key: string): string {
    if (key.length <= 8) {
      return '*'.repeat(key.length);
    }
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  }
}

// =============================================================================
// EXAMPLE CONTROLLER
// =============================================================================

@Controller('throttler-example')
export class ThrottlerExampleController {
  private readonly logger = new Logger(ThrottlerExampleController.name);

  constructor(
    private readonly throttlerService: ThrottlerService,
    private readonly errorHandler: ErrorHandlerService,
  ) {}

  @Get('check-rate-limit')
  async checkRateLimit(): Promise<any> {
    try {
      const clientId = 'example-client-123';
      const result = await this.throttlerService.checkRateLimit(clientId, 5, 60000, 30000);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Rate limit check failed', error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof ThrottlerError ? error.code : 'UNKNOWN_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('reset-rate-limit')
  async resetRateLimit(): Promise<any> {
    try {
      const clientId = 'example-client-123';
      await this.throttlerService.resetRateLimit(clientId);
      
      return {
        success: true,
        message: 'Rate limit reset successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Rate limit reset failed', error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof ThrottlerError ? error.code : 'UNKNOWN_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('metrics')
  async getMetrics(): Promise<any> {
    try {
      const metrics = await this.throttlerService.getMetrics();
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics', error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('performance-demo')
  async performanceDemo(): Promise<any> {
    try {
      await this.errorHandler.performanceExample();
      
      return {
        success: true,
        message: 'Performance demo completed',
        metrics: this.errorHandler.getMetrics(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Performance demo failed', error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// =============================================================================
// EXAMPLE MODULE
// =============================================================================

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      failureStrategy: 'fail-open',
      enableDebugLogging: true,
      maxWindowSize: 1000,
      enableRedisFunctions: true,
    }),
  ],
  controllers: [ThrottlerExampleController],
  providers: [ErrorHandlerService, ThrottlerService],
})
export class ErrorHandlingExampleModule {}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example of how to use the error handling and logging features
 */
export async function demonstrateErrorHandling(): Promise<void> {
  const logger = LoggerFactory.create('ErrorHandlingDemo', {
    level: LogLevel.DEBUG,
    performance: true,
    security: true,
  });

  // Example 1: Basic logging
  logger.info('Starting error handling demonstration');
  logger.debug('Debug information', { userId: 'user123', action: 'rate-limit-check' });
  logger.warn('Warning message', { threshold: 0.8, current: 0.85 });

  // Example 2: Error logging
  try {
    throw new RedisConnectionError('Connection failed', new Error('ECONNREFUSED'));
  } catch (error) {
    logger.error('Redis connection failed', error instanceof Error ? error : new Error(String(error)), {
      host: 'localhost',
      port: 6379,
      retryAttempt: 3,
    });
  }

  // Example 3: Security event logging
  logger.security(
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded for suspicious client',
    SecurityEventSeverity.HIGH,
    {
      clientId: 'suspicious-client-456',
      ipAddress: '192.168.1.100',
      rateLimit: {
        key: 'user:suspicious-client-456',
        limit: 10,
        current: 15,
        resetTime: 60,
        throttlerName: 'api-throttler',
      },
    },
  );

  // Example 4: Performance monitoring
  const endTiming = logger.startTiming('demo-operation');
  
  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  endTiming({ itemsProcessed: 100, cacheHit: true });

  // Example 5: Get metrics
  const metrics = logger.getPerformanceMetrics();
  logger.info('Performance metrics', { metrics });

  logger.info('Error handling demonstration completed');
}

export { ErrorHandlingExampleModule as default };