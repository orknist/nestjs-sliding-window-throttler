/**
 * @fileoverview NestJS application module with OpenTelemetry throttler integration
 */

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  FailureStrategy,
  createConfig 
} from 'nestjs-sliding-window-throttler';
import { OpenTelemetryThrottlerLogger } from './opentelemetry-logger';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Configure sliding window throttler with OpenTelemetry logging
    SlidingWindowThrottlerModule.forRootAsync({
      useFactory: () => {
        const config = createConfig({
          REDIS_HOST: process.env.REDIS_HOST || 'localhost',
          REDIS_PORT: process.env.REDIS_PORT || '6379',
          REDIS_PASSWORD: process.env.REDIS_PASSWORD,
          FAILURE_STRATEGY: 'fail-closed', // Fail closed in production
          ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development' ? 'true' : 'false',
        });
        
        return config;
      },
    }),
    
    // Configure NestJS throttler
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      inject: [SlidingWindowThrottlerStorage],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
          {
            name: 'strict',
            ttl: 60000, // 1 minute
            limit: 10, // 10 requests per minute
            blockDuration: 300000, // Block for 5 minutes
          },
        ],
        storage,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    // Provide OpenTelemetry logger for throttler
    {
      provide: 'THROTTLER_LOGGER',
      useClass: OpenTelemetryThrottlerLogger,
    },
  ],
})
export class AppModule {}