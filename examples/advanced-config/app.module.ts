/**
 * @fileoverview Advanced configuration example with async setup
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SlidingWindowThrottlerModule, FailureStrategy } from 'nestjs-sliding-window-throttler';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Load configuration from environment
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Configure the sliding window throttler with async configuration
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          keyPrefix: configService.get('REDIS_KEY_PREFIX', 'throttle:'),
          connectTimeout: configService.get('REDIS_CONNECT_TIMEOUT', 10000),
          commandTimeout: configService.get('REDIS_COMMAND_TIMEOUT', 5000),
          tls: configService.get('REDIS_TLS', false),
        },
        failureStrategy: configService.get('NODE_ENV') === 'production' 
          ? FailureStrategy.FAIL_CLOSED 
          : FailureStrategy.FAIL_OPEN,
        enableDebugLogging: configService.get('NODE_ENV') === 'development',
        maxWindowSize: configService.get('THROTTLER_MAX_WINDOW_SIZE', 1000),
        functionLibraryPrefix: configService.get('THROTTLER_FUNCTION_PREFIX', 'myapp'),
        enableRedisFunctions: configService.get('THROTTLER_ENABLE_REDIS_FUNCTIONS', true),
      }),
      inject: [ConfigService],
    }),
    
    // Configure @nestjs/throttler with multiple named throttlers
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule, ConfigModule],
      useFactory: (storage, configService: ConfigService) => ({
        throttlers: [
          // Default throttling for general API usage
          {
            name: 'default',
            ttl: 60 * 1000, // 1 minute
            limit: configService.get('THROTTLER_DEFAULT_LIMIT', 100),
            blockDuration: configService.get('THROTTLER_DEFAULT_BLOCK_DURATION', 0),
          },
          // Authentication endpoints
          {
            name: 'auth',
            ttl: 15 * 60 * 1000, // 15 minutes
            limit: configService.get('THROTTLER_AUTH_LIMIT', 5),
            blockDuration: configService.get('THROTTLER_AUTH_BLOCK_DURATION', 15 * 60 * 1000),
          },
          // OTP sending
          {
            name: 'otp',
            ttl: 60 * 60 * 1000, // 1 hour
            limit: configService.get('THROTTLER_OTP_LIMIT', 3),
            blockDuration: configService.get('THROTTLER_OTP_BLOCK_DURATION', 30 * 60 * 1000),
          },
          // File uploads
          {
            name: 'upload',
            ttl: 60 * 1000, // 1 minute
            limit: configService.get('THROTTLER_UPLOAD_LIMIT', 5),
            blockDuration: configService.get('THROTTLER_UPLOAD_BLOCK_DURATION', 5 * 60 * 1000),
          },
        ],
        storage,
        // Skip throttling for certain user agents
        ignoreUserAgents: [
          /googlebot/i,
          /bingbot/i,
          /health-check/i,
        ],
        // Custom skip logic
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest();
          // Skip throttling for admin users
          return request.user?.role === 'admin';
        },
      }),
      inject: [SlidingWindowThrottlerStorage, ConfigService],
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