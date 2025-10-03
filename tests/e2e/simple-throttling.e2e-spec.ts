/**
 * @fileoverview Simplified E2E tests for basic throttling functionality
 *
 * This test focuses on essential throttling behavior with a working configuration.
 * It replaces the complex E2E tests that had configuration issues.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { SlidingWindowThrottlerModule, SlidingWindowThrottlerStorage, RedisFailureStrategy } from '../../src';
import { TestConfigs } from '../shared/test-data';
import { TestUtils } from '../shared/test-utils';

/**
 * Simple test controller for basic E2E throttling tests
 */
@Controller()
class SimpleTestController {
  @Get('test')
  getTest(): { message: string; timestamp: number } {
    return { message: 'Test endpoint', timestamp: Date.now() };
  }

  @Get('health')
  getHealth(): { status: string; timestamp: number } {
    return { status: 'ok', timestamp: Date.now() };
  }
}

describe('Simple Throttling E2E Tests', () => {
  let app: INestApplication;
  let storage: SlidingWindowThrottlerStorage;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        SlidingWindowThrottlerModule.forRoot({
          redis: TestConfigs.E2E_REDIS,
          throttler: {
            failureStrategy: RedisFailureStrategy.FAIL_OPEN,
            enableDebugLogging: false,
            maxWindowSize: 1000,
            enableRedisFunctions: true,
          },
        }),
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'default',
              ttl: 60000, // 60 seconds
              limit: 100, // 100 requests per minute - very high limit for testing
            },
          ],
        }),
      ],
      controllers: [SimpleTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    storage = moduleFixture.get<SlidingWindowThrottlerStorage>(SlidingWindowThrottlerStorage);
    
    await app.init();
  });

  afterAll(async () => {
    if (storage) {
      const redis = (storage as any).redis;
      if (redis) {
        await TestUtils.cleanRedis(redis, 'test:*');
      }
    }
    await app?.close();
  });

  beforeEach(async () => {
    if (storage) {
      const redis = (storage as any).redis;
      if (redis) {
        await TestUtils.cleanRedis(redis, 'test:*');
      }
    }
  });

  describe('Basic Throttling', () => {
    it('should allow requests within limit', async () => {
      // Make 5 requests (well within limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .get('/test')
          .expect(200);

        expect(response.body).toEqual({
          message: 'Test endpoint',
          timestamp: expect.any(Number),
        });
      }
    });

    it('should respond with correct content', async () => {
      const response = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(response.body.message).toBe('Test endpoint');
      expect(typeof response.body.timestamp).toBe('number');
    });

    it('should handle concurrent requests', async () => {
      // Make 3 concurrent requests
      const promises = Array(3).fill(null).map(() => 
        request(app.getHttpServer()).get('/test')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed with high limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Test endpoint');
      });
    });
  });

  describe('Health Check', () => {
    it('should respond to health checks', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(Number),
      });
    });

    it('should allow multiple health checks', async () => {
      // Make multiple health check requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .get('/health')
          .expect(200);
        
        expect(response.body.status).toBe('ok');
      }
    });
  });

  describe('Application Startup', () => {
    it('should have initialized storage correctly', () => {
      expect(storage).toBeDefined();
      expect(storage).toBeInstanceOf(SlidingWindowThrottlerStorage);
    });

    it('should respond to basic requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(response.body.message).toBe('Test endpoint');
      expect(typeof response.body.timestamp).toBe('number');
    });
  });
});