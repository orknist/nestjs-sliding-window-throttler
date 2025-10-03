/**
 * @fileoverview Example of application BEFORE migration to sliding window throttler
 * 
 * This shows a typical NestJS application using the default @nestjs/throttler
 * with in-memory storage or basic Redis storage.
 */

import { Module, Controller, Get, Post, Body } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';

// =============================================================================
// BEFORE: Default Throttler Configuration
// =============================================================================

/**
 * Basic throttler configuration with default storage (in-memory)
 * Issues:
 * - Fixed window algorithm (less accurate)
 * - No persistence across restarts
 * - No clustering support
 * - Higher memory usage
 * - No block duration support
 */
@Module({
  imports: [
    // Simple configuration with fixed windows
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'strict',
        ttl: 60000, // 1 minute
        limit: 10,  // 10 requests per minute
      },
    ]),
  ],
  controllers: [BeforeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class BeforeBasicModule {}

/**
 * Advanced configuration with Redis storage (still using fixed windows)
 * Issues:
 * - Still uses fixed window algorithm
 * - Multiple Redis operations per request
 * - No automatic cleanup of expired data
 * - Limited error handling
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    // Redis storage configuration (still fixed window)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 100,
          },
          {
            name: 'auth',
            ttl: 900000, // 15 minutes
            limit: 5,
          },
          {
            name: 'otp',
            ttl: 3600000, // 1 hour
            limit: 3,
          },
        ],
        // Basic Redis storage (fixed window)
        storage: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest();
          return request.user?.role === 'admin';
        },
      }),
    }),
  ],
  controllers: [BeforeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class BeforeAdvancedModule {}

// =============================================================================
// BEFORE: Controller Implementation
// =============================================================================

@Controller('api')
export class BeforeController {
  
  /**
   * Default rate limiting (100 requests per minute)
   * Issues with fixed window:
   * - Burst traffic at window boundaries
   * - Less accurate rate limiting
   * - No block duration after limit exceeded
   */
  @Get('data')
  getData(): any {
    return {
      message: 'Data retrieved successfully',
      timestamp: new Date().toISOString(),
      rateLimiting: {
        algorithm: 'Fixed Window',
        accuracy: '~70%',
        issues: [
          'Burst traffic at window boundaries',
          'Less accurate rate limiting',
          'No block duration support',
        ],
      },
    };
  }
  
  /**
   * Authentication endpoint with strict limiting
   * Issues:
   * - No progressive blocking
   * - Fixed window allows bursts
   * - No violation tracking
   */
  @Post('auth/login')
  @Throttle({ auth: { limit: 5, ttl: 900000 } }) // 5 per 15 minutes
  login(@Body() credentials: any): any {
    return {
      success: true,
      token: 'jwt-token-example',
      rateLimiting: {
        algorithm: 'Fixed Window',
        limit: 5,
        window: '15 minutes',
        issues: [
          'No progressive blocking for repeat offenders',
          'Allows burst of 5 requests at window start',
          'No violation history tracking',
        ],
      },
    };
  }
  
  /**
   * OTP endpoint with very strict limiting
   * Issues:
   * - No block duration after abuse
   * - Fixed window timing attacks possible
   * - No security event logging
   */
  @Post('auth/send-otp')
  @Throttle({ otp: { limit: 3, ttl: 3600000 } }) // 3 per hour
  sendOtp(@Body() data: { phone: string }): any {
    return {
      success: true,
      message: 'OTP sent successfully',
      rateLimiting: {
        algorithm: 'Fixed Window',
        limit: 3,
        window: '1 hour',
        issues: [
          'No block duration after limit exceeded',
          'Timing attacks possible at window boundaries',
          'No security event logging',
          'No progressive penalties',
        ],
      },
    };
  }
  
  /**
   * File upload endpoint
   * Issues:
   * - No different limits for different file types
   * - No block duration for abuse
   * - Memory inefficient for tracking
   */
  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  uploadFile(@Body() file: any): any {
    return {
      success: true,
      fileId: 'file-' + Date.now(),
      rateLimiting: {
        algorithm: 'Fixed Window',
        limit: 10,
        window: '1 minute',
        issues: [
          'Same limits for all file types/sizes',
          'No block duration for upload abuse',
          'Memory inefficient tracking',
        ],
      },
    };
  }
}

// =============================================================================
// BEFORE: Environment Configuration
// =============================================================================

/**
 * Environment variables for the old system
 * Issues:
 * - Limited configuration options
 * - No failure strategy configuration
 * - No performance tuning options
 * - No security monitoring options
 */
export const BEFORE_ENV_EXAMPLE = `
# Basic Redis configuration (if using Redis storage)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Limited throttler configuration
THROTTLER_DEFAULT_LIMIT=100
THROTTLER_AUTH_LIMIT=5
THROTTLER_OTP_LIMIT=3

# No advanced options available:
# - No failure strategy configuration
# - No block duration settings
# - No violation tracking
# - No performance tuning
# - No security monitoring
`;

// =============================================================================
// BEFORE: Performance and Accuracy Issues
// =============================================================================

/**
 * Performance issues with the old system:
 * 
 * 1. Fixed Window Algorithm:
 *    - Only ~70% accuracy in rate limiting
 *    - Allows burst traffic at window boundaries
 *    - Example: 100 requests at 11:59:59, then 100 more at 12:00:01
 * 
 * 2. Multiple Redis Operations:
 *    - 2-3 Redis operations per request
 *    - Higher latency and resource usage
 *    - No atomic operations
 * 
 * 3. Memory Usage:
 *    - No automatic cleanup of expired data
 *    - Memory grows over time
 *    - No size limits on tracking data
 * 
 * 4. Limited Error Handling:
 *    - No graceful degradation
 *    - No failure strategies
 *    - Basic error messages
 * 
 * 5. No Advanced Features:
 *    - No block duration after limit exceeded
 *    - No progressive blocking for repeat offenders
 *    - No violation tracking
 *    - No security event logging
 *    - No performance monitoring
 */

export const BEFORE_PERFORMANCE_ISSUES = {
  accuracy: '~70%',
  redisOperationsPerRequest: '2-3',
  memoryUsage: 'High (no cleanup)',
  errorHandling: 'Basic',
  blockDuration: 'Not supported',
  progressiveBlocking: 'Not supported',
  violationTracking: 'Not supported',
  securityLogging: 'Not supported',
  performanceMonitoring: 'Limited',
  clusterSupport: 'Limited',
  failureStrategies: 'Not supported',
};

// =============================================================================
// BEFORE: Testing Challenges
// =============================================================================

/**
 * Testing challenges with the old system:
 * 
 * 1. Fixed Window Testing:
 *    - Hard to test edge cases at window boundaries
 *    - Timing-dependent tests
 *    - Inconsistent behavior
 * 
 * 2. Limited Mocking:
 *    - Hard to mock Redis storage behavior
 *    - No built-in testing utilities
 *    - Complex setup for integration tests
 * 
 * 3. No Metrics:
 *    - No built-in performance metrics
 *    - Hard to measure accuracy
 *    - No monitoring capabilities
 */

export const BEFORE_TESTING_EXAMPLE = `
// Testing was more complex and less reliable
describe('Old Throttler Tests', () => {
  it('should rate limit requests (timing dependent)', async () => {
    // Make requests quickly
    for (let i = 0; i < 15; i++) {
      await request(app.getHttpServer()).get('/api/data');
    }
    
    // This test could be flaky due to fixed window timing
    const response = await request(app.getHttpServer())
      .get('/api/data')
      .expect(429);
  });
  
  it('should reset at window boundary (flaky)', async () => {
    // This test depends on exact timing and could fail
    // if the window boundary occurs during test execution
    
    // Fill up the rate limit
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).get('/api/data');
    }
    
    // Wait for window to reset (timing dependent)
    await new Promise(resolve => setTimeout(resolve, 61000));
    
    // Should work again (but timing could be off)
    await request(app.getHttpServer())
      .get('/api/data')
      .expect(200);
  });
});
`;

// =============================================================================
// BEFORE: Monitoring and Observability
// =============================================================================

/**
 * Limited monitoring capabilities:
 * 
 * 1. No Built-in Metrics:
 *    - No request counting
 *    - No latency tracking
 *    - No error rate monitoring
 * 
 * 2. Basic Logging:
 *    - Only basic error messages
 *    - No structured logging
 *    - No security event logging
 * 
 * 3. No Health Checks:
 *    - No Redis connection monitoring
 *    - No performance monitoring
 *    - No alerting capabilities
 */

export const BEFORE_MONITORING_LIMITATIONS = {
  builtInMetrics: false,
  requestCounting: false,
  latencyTracking: false,
  errorRateMonitoring: false,
  structuredLogging: false,
  securityEventLogging: false,
  healthChecks: false,
  redisMonitoring: false,
  performanceMonitoring: false,
  alerting: false,
  dashboards: false,
};

// =============================================================================
// BEFORE: Security Limitations
// =============================================================================

/**
 * Security limitations of the old system:
 * 
 * 1. No Block Duration:
 *    - Attackers can immediately retry after rate limit
 *    - No progressive penalties
 *    - No cooling-off period
 * 
 * 2. No Violation Tracking:
 *    - No history of abuse
 *    - No pattern detection
 *    - No repeat offender identification
 * 
 * 3. Limited Security Logging:
 *    - No security event logging
 *    - No suspicious pattern detection
 *    - No audit trail
 * 
 * 4. Fixed Window Vulnerabilities:
 *    - Timing attacks possible
 *    - Burst attacks at window boundaries
 *    - Predictable reset times
 */

export const BEFORE_SECURITY_ISSUES = {
  blockDuration: 'Not supported - attackers can retry immediately',
  progressivePenalties: 'Not supported - same penalty every time',
  violationTracking: 'Not supported - no abuse history',
  securityLogging: 'Basic - no security event logging',
  patternDetection: 'Not supported - no suspicious pattern detection',
  auditTrail: 'Limited - basic request logging only',
  timingAttacks: 'Vulnerable - predictable window boundaries',
  burstAttacks: 'Vulnerable - allows bursts at window start',
  repeatOffenders: 'Not identified - no tracking across windows',
};

export { BeforeBasicModule, BeforeAdvancedModule, BeforeController };