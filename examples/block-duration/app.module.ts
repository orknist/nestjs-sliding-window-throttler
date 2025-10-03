/**
 * @fileoverview Block Duration configuration example
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  BlockDurationStrategy,
  ThrottlerContext,
  FailureStrategy 
} from 'nestjs-sliding-window-throttler';
import { AppController } from './app.controller';
import { BlockStatusService } from './block-status.service';
import { BlockDurationController } from './block-duration.controller';

// Custom progressive block duration strategy
export class ProgressiveBlockStrategy implements BlockDurationStrategy {
  calculateBlockDuration(context: ThrottlerContext): number {
    const { violations, throttlerName } = context;
    
    switch (throttlerName) {
      case 'auth':
        return this.calculateAuthBlockDuration(violations);
      case 'otp':
        return this.calculateOtpBlockDuration(violations);
      case 'upload':
        return this.calculateUploadBlockDuration(violations);
      default:
        return this.calculateDefaultBlockDuration(violations);
    }
  }
  
  private calculateAuthBlockDuration(violations: number): number {
    // Progressive blocking for authentication
    if (violations <= 1) return 5 * 60 * 1000;      // 5 minutes
    if (violations <= 3) return 15 * 60 * 1000;     // 15 minutes
    if (violations <= 5) return 60 * 60 * 1000;     // 1 hour
    return 24 * 60 * 60 * 1000;                     // 24 hours
  }
  
  private calculateOtpBlockDuration(violations: number): number {
    // Very strict for OTP abuse
    if (violations <= 1) return 30 * 60 * 1000;     // 30 minutes
    if (violations <= 2) return 2 * 60 * 60 * 1000; // 2 hours
    return 24 * 60 * 60 * 1000;                     // 24 hours
  }
  
  private calculateUploadBlockDuration(violations: number): number {
    // Moderate for file uploads
    return Math.min(violations * 5 * 60 * 1000, 30 * 60 * 1000); // Max 30 minutes
  }
  
  private calculateDefaultBlockDuration(violations: number): number {
    // Standard progressive blocking
    return Math.min(violations * 2 * 60 * 1000, 15 * 60 * 1000); // Max 15 minutes
  }
}

// Example 1: Basic Block Duration Configuration
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    SlidingWindowThrottlerModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      failureStrategy: FailureStrategy.FAIL_OPEN,
      enableDebugLogging: true,
      enableViolationTracking: true, // Required for progressive blocking
    }),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000, // 1 minute
            limit: 10,
            blockDuration: 5 * 60 * 1000, // Block for 5 minutes
          },
          {
            name: 'auth',
            ttl: 15 * 60 * 1000, // 15 minutes
            limit: 5,
            blockDuration: 15 * 60 * 1000, // Block for 15 minutes
          },
          {
            name: 'otp',
            ttl: 60 * 60 * 1000, // 1 hour
            limit: 3,
            blockDuration: 30 * 60 * 1000, // Block for 30 minutes
          },
          {
            name: 'upload',
            ttl: 60 * 1000, // 1 minute
            limit: 5,
            blockDuration: 10 * 60 * 1000, // Block for 10 minutes
          },
          {
            name: 'public',
            ttl: 60 * 1000, // 1 minute
            limit: 100,
            blockDuration: 0, // No blocking, just rate limiting
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController, BlockDurationController],
  providers: [
    BlockStatusService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class BasicBlockDurationModule {}

// Example 2: Advanced Block Duration with Custom Strategy
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        failureStrategy: configService.get('NODE_ENV') === 'production' 
          ? FailureStrategy.FAIL_CLOSED 
          : FailureStrategy.FAIL_OPEN,
        enableDebugLogging: configService.get('NODE_ENV') === 'development',
        enableViolationTracking: true,
        blockDurationStrategy: ProgressiveBlockStrategy, // Custom strategy
        violationResetInterval: 24 * 60 * 60 * 1000, // Reset violations after 24 hours
        maxViolationsTracked: 10, // Track up to 10 violations per client
      }),
      inject: [ConfigService],
    }),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule, ConfigModule],
      useFactory: (storage: SlidingWindowThrottlerStorage, configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000,
            limit: configService.get('THROTTLER_DEFAULT_LIMIT', 10),
            // Block duration calculated by ProgressiveBlockStrategy
          },
          {
            name: 'auth',
            ttl: 15 * 60 * 1000,
            limit: configService.get('THROTTLER_AUTH_LIMIT', 5),
            // Progressive blocking: 5min -> 15min -> 1hr -> 24hr
          },
          {
            name: 'otp',
            ttl: 60 * 60 * 1000,
            limit: configService.get('THROTTLER_OTP_LIMIT', 3),
            // Progressive blocking: 30min -> 2hr -> 24hr
          },
          {
            name: 'upload',
            ttl: 60 * 1000,
            limit: configService.get('THROTTLER_UPLOAD_LIMIT', 5),
            // Progressive blocking: 5min -> 10min -> 15min -> 30min (max)
          },
        ],
        storage,
        
        // Skip blocking for certain conditions
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest();
          
          // Skip for admin users
          if (request.user?.role === 'admin') {
            return true;
          }
          
          // Skip for health checks
          if (request.path === '/health') {
            return true;
          }
          
          return false;
        },
      }),
      inject: [SlidingWindowThrottlerStorage, ConfigService],
    }),
  ],
  controllers: [AppController, BlockDurationController],
  providers: [
    BlockStatusService,
    ProgressiveBlockStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AdvancedBlockDurationModule {}

// Example 3: Time-Based Block Duration Strategy
export class TimeBasedBlockStrategy implements BlockDurationStrategy {
  calculateBlockDuration(context: ThrottlerContext): number {
    const { throttlerName, timestamp } = context;
    const hour = new Date(timestamp).getHours();
    
    // Different block durations based on time of day
    const isBusinessHours = hour >= 9 && hour <= 17;
    const isNightTime = hour >= 22 || hour <= 6;
    
    switch (throttlerName) {
      case 'auth':
        if (isNightTime) return 60 * 60 * 1000;      // 1 hour at night
        if (isBusinessHours) return 15 * 60 * 1000;  // 15 minutes during business hours
        return 30 * 60 * 1000;                       // 30 minutes otherwise
        
      case 'otp':
        if (isNightTime) return 4 * 60 * 60 * 1000;  // 4 hours at night
        return 2 * 60 * 60 * 1000;                   // 2 hours during day
        
      default:
        return isBusinessHours ? 5 * 60 * 1000 : 10 * 60 * 1000;
    }
  }
}

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      redis: { host: 'localhost', port: 6379 },
      blockDurationStrategy: TimeBasedBlockStrategy,
      enableViolationTracking: true,
    }),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          { name: 'default', ttl: 60 * 1000, limit: 10 },
          { name: 'auth', ttl: 15 * 60 * 1000, limit: 5 },
          { name: 'otp', ttl: 60 * 60 * 1000, limit: 3 },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController, BlockDurationController],
  providers: [
    BlockStatusService,
    TimeBasedBlockStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class TimeBasedBlockDurationModule {}

// Export the basic module as default
export { BasicBlockDurationModule as AppModule };