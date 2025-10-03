/**
 * @fileoverview Basic usage example for SlidingWindowThrottlerModule
 */

import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  createDevelopmentConfiguration,
  FailureStrategy 
} from 'nestjs-sliding-window-throttler';
import { AppController } from './app.controller';

// Example 1: Using environment variables (recommended)
@Module({
  imports: [
    // Automatically reads configuration from environment variables
    // Set these in your .env file:
    // REDIS_HOST=localhost
    // REDIS_PORT=6379
    // FAILURE_STRATEGY=fail-open
    // ENABLE_DEBUG_LOGGING=true
    SlidingWindowThrottlerModule.forRoot(),
    
    // Configure @nestjs/throttler to use our storage
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000, // 1 minute
            limit: 10, // 10 requests per minute
            blockDuration: 5 * 60 * 1000, // Block for 5 minutes after limit exceeded
          },
          {
            name: 'strict',
            ttl: 60 * 1000, // 1 minute
            limit: 5, // 5 requests per minute
            blockDuration: 10 * 60 * 1000, // Block for 10 minutes after limit exceeded
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController],
  providers: [
    // Apply throttling globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

// Example 2: Using configuration helper
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createDevelopmentConfiguration({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_KEY_PREFIX: 'myapp:throttle',
        ENABLE_DEBUG_LOGGING: 'true',
      }),
    ),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000,
            limit: 10,
            blockDuration: 5 * 60 * 1000,
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModuleWithHelper {}

// Example 3: Direct configuration object
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_KEY_PREFIX: 'throttle',
      FAILURE_STRATEGY: 'fail-open',
      ENABLE_DEBUG_LOGGING: 'true',
      MAX_WINDOW_SIZE: '1000',
    }),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000,
            limit: 10,
            blockDuration: 5 * 60 * 1000,
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModuleWithDirectConfig {}