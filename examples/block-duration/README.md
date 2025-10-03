# Block Duration Configuration Example

This example demonstrates how to configure and use block duration functionality, which temporarily blocks clients after they exceed rate limits.

## Overview

Block duration is a powerful feature that goes beyond simple rate limiting by temporarily blocking clients who exceed their limits. This helps prevent abuse and gives legitimate users a better experience.

## Basic Block Duration Setup

### 1. Simple Block Duration Configuration

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage 
} from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(),
    
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60 * 1000, // 1 minute window
            limit: 10, // 10 requests per minute
            blockDuration: 5 * 60 * 1000, // Block for 5 minutes after limit exceeded
          },
          {
            name: 'strict',
            ttl: 60 * 1000, // 1 minute window
            limit: 5, // 5 requests per minute
            blockDuration: 15 * 60 * 1000, // Block for 15 minutes after limit exceeded
          },
        ],
        storage,
      }),
      inject: [SlidingWindowThrottlerStorage],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 2. Controller with Block Duration

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller('api')
export class BlockDurationController {
  
  /**
   * Default endpoint with 5-minute block duration
   */
  @Get('data')
  getData(): any {
    return {
      message: 'Data retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Authentication with longer block duration
   */
  @Post('auth/login')
  @Throttle({ 
    auth: { 
      limit: 5, 
      ttl: 15 * 60 * 1000, // 15 minutes
      blockDuration: 30 * 60 * 1000, // Block for 30 minutes
    } 
  })
  login(@Body() credentials: any): any {
    // Authentication logic
    return {
      success: true,
      token: 'jwt-token',
      message: 'Login successful',
    };
  }
  
  /**
   * OTP sending with very long block duration
   */
  @Post('auth/send-otp')
  @Throttle({ 
    otp: { 
      limit: 3, 
      ttl: 60 * 60 * 1000, // 1 hour
      blockDuration: 2 * 60 * 60 * 1000, // Block for 2 hours
    } 
  })
  sendOtp(@Body() data: { email: string }): any {
    // OTP sending logic
    return {
      success: true,
      message: 'OTP sent successfully',
      email: data.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Masked email
    };
  }
  
  /**
   * No block duration (traditional rate limiting)
   */
  @Get('public')
  @Throttle({ 
    public: { 
      limit: 100, 
      ttl: 60 * 1000, // 1 minute
      blockDuration: 0, // No blocking, just rate limiting
    } 
  })
  getPublicData(): any {
    return {
      message: 'Public data - no blocking applied',
      rateLimit: '100 requests per minute',
    };
  }
}
```

## Advanced Block Duration Strategies

### 1. Progressive Block Duration

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  SlidingWindowThrottlerModule,
  BlockDurationStrategy,
  ThrottlerContext 
} from 'nestjs-sliding-window-throttler';

@Injectable()
export class ProgressiveBlockStrategy implements BlockDurationStrategy {
  
  calculateBlockDuration(context: ThrottlerContext): number {
    const { violations, throttlerName, clientId } = context;
    
    // Progressive blocking: longer blocks for repeat offenders
    switch (throttlerName) {
      case 'auth':
        return this.calculateAuthBlockDuration(violations);
      case 'otp':
        return this.calculateOtpBlockDuration(violations);
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
  
  private calculateDefaultBlockDuration(violations: number): number {
    // Standard progressive blocking
    return Math.min(violations * 5 * 60 * 1000, 60 * 60 * 1000); // Max 1 hour
  }
}

// Module configuration with custom strategy
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: 'localhost',
          port: 6379,
        },
        blockDurationStrategy: ProgressiveBlockStrategy,
        enableViolationTracking: true, // Track repeat violations
      }),
    }),
  ],
  providers: [ProgressiveBlockStrategy],
})
export class AdvancedBlockModule {}
```

### 2. Time-Based Block Duration

```typescript
@Injectable()
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
```

### 3. IP-Based Block Duration

```typescript
@Injectable()
export class IpBasedBlockStrategy implements BlockDurationStrategy {
  
  calculateBlockDuration(context: ThrottlerContext): number {
    const { clientId, throttlerName, metadata } = context;
    const ipAddress = metadata?.ipAddress || clientId;
    
    // Different strategies based on IP type
    if (this.isInternalIP(ipAddress)) {
      return 1 * 60 * 1000; // 1 minute for internal IPs
    }
    
    if (this.isKnownBotIP(ipAddress)) {
      return 24 * 60 * 60 * 1000; // 24 hours for known bots
    }
    
    if (this.isSuspiciousIP(ipAddress)) {
      return 2 * 60 * 60 * 1000; // 2 hours for suspicious IPs
    }
    
    // Standard block duration
    return this.getStandardBlockDuration(throttlerName);
  }
  
  private isInternalIP(ip: string): boolean {
    return ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '127.0.0.1';
  }
  
  private isKnownBotIP(ip: string): boolean {
    // Check against known bot IP ranges
    const botRanges = ['66.249.', '157.55.', '40.77.']; // Google, Bing, etc.
    return botRanges.some(range => ip.startsWith(range));
  }
  
  private isSuspiciousIP(ip: string): boolean {
    // Check against threat intelligence feeds
    // This would typically integrate with external services
    return false;
  }
  
  private getStandardBlockDuration(throttlerName: string): number {
    switch (throttlerName) {
      case 'auth': return 15 * 60 * 1000;
      case 'otp': return 30 * 60 * 1000;
      default: return 5 * 60 * 1000;
    }
  }
}
```

## Block Duration Monitoring

### 1. Block Status Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';

@Injectable()
export class BlockStatusService {
  private readonly logger = new Logger(BlockStatusService.name);
  
  constructor(
    private readonly throttlerStorage: SlidingWindowThrottlerStorage,
  ) {}
  
  /**
   * Check if a client is currently blocked
   */
  async isBlocked(clientId: string, throttlerName: string = 'default'): Promise<{
    blocked: boolean;
    remainingTime?: number;
    blockReason?: string;
  }> {
    try {
      const status = await this.throttlerStorage.getBlockStatus(clientId, throttlerName);
      
      return {
        blocked: status.isBlocked,
        remainingTime: status.remainingTime,
        blockReason: status.reason,
      };
    } catch (error) {
      this.logger.error('Failed to check block status', error);
      return { blocked: false };
    }
  }
  
  /**
   * Get all currently blocked clients
   */
  async getBlockedClients(): Promise<Array<{
    clientId: string;
    throttlerName: string;
    blockedAt: Date;
    remainingTime: number;
    violations: number;
  }>> {
    try {
      return await this.throttlerStorage.getBlockedClients();
    } catch (error) {
      this.logger.error('Failed to get blocked clients', error);
      return [];
    }
  }
  
  /**
   * Manually unblock a client (admin function)
   */
  async unblockClient(clientId: string, throttlerName: string = 'default', reason?: string): Promise<void> {
    try {
      await this.throttlerStorage.unblockClient(clientId, throttlerName);
      
      this.logger.warn('Client manually unblocked', {
        clientId: this.maskClientId(clientId),
        throttlerName,
        reason,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to unblock client', error);
      throw error;
    }
  }
  
  /**
   * Get block statistics
   */
  async getBlockStatistics(): Promise<{
    totalBlocked: number;
    blocksByThrottler: Record<string, number>;
    averageBlockDuration: number;
    topBlockedClients: Array<{ clientId: string; violations: number }>;
  }> {
    try {
      const stats = await this.throttlerStorage.getBlockStatistics();
      
      return {
        totalBlocked: stats.totalBlocked,
        blocksByThrottler: stats.blocksByThrottler,
        averageBlockDuration: stats.averageBlockDuration,
        topBlockedClients: stats.topBlockedClients.map(client => ({
          clientId: this.maskClientId(client.clientId),
          violations: client.violations,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get block statistics', error);
      throw error;
    }
  }
  
  private maskClientId(clientId: string): string {
    if (clientId.length <= 8) {
      return '*'.repeat(clientId.length);
    }
    return clientId.substring(0, 4) + '*'.repeat(clientId.length - 8) + clientId.substring(clientId.length - 4);
  }
}
```

### 2. Block Duration Controller

```typescript
import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../guards';
import { BlockStatusService } from './block-status.service';

@Controller('admin/throttler')
@UseGuards(RolesGuard)
@Roles('admin')
export class BlockDurationController {
  
  constructor(private readonly blockStatusService: BlockStatusService) {}
  
  /**
   * Get block status for a specific client
   */
  @Get('status/:clientId')
  async getBlockStatus(@Param('clientId') clientId: string): Promise<any> {
    const status = await this.blockStatusService.isBlocked(clientId);
    
    return {
      clientId: clientId,
      ...status,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get all currently blocked clients
   */
  @Get('blocked')
  async getBlockedClients(): Promise<any> {
    const blockedClients = await this.blockStatusService.getBlockedClients();
    
    return {
      total: blockedClients.length,
      clients: blockedClients,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Manually unblock a client
   */
  @Post('unblock')
  async unblockClient(@Body() data: { 
    clientId: string; 
    throttlerName?: string; 
    reason?: string; 
  }): Promise<any> {
    await this.blockStatusService.unblockClient(
      data.clientId, 
      data.throttlerName || 'default',
      data.reason
    );
    
    return {
      success: true,
      message: 'Client unblocked successfully',
      clientId: data.clientId,
      throttlerName: data.throttlerName || 'default',
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get block statistics
   */
  @Get('statistics')
  async getBlockStatistics(): Promise<any> {
    const stats = await this.blockStatusService.getBlockStatistics();
    
    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Testing Block Duration

### 1. Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';
import { BlockStatusService } from './block-status.service';

describe('BlockStatusService', () => {
  let service: BlockStatusService;
  let storage: jest.Mocked<SlidingWindowThrottlerStorage>;
  
  beforeEach(async () => {
    const mockStorage = {
      getBlockStatus: jest.fn(),
      getBlockedClients: jest.fn(),
      unblockClient: jest.fn(),
      getBlockStatistics: jest.fn(),
    };
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockStatusService,
        {
          provide: SlidingWindowThrottlerStorage,
          useValue: mockStorage,
        },
      ],
    }).compile();
    
    service = module.get<BlockStatusService>(BlockStatusService);
    storage = module.get(SlidingWindowThrottlerStorage);
  });
  
  describe('isBlocked', () => {
    it('should return block status for client', async () => {
      const mockStatus = {
        isBlocked: true,
        remainingTime: 300000, // 5 minutes
        reason: 'Rate limit exceeded',
      };
      
      storage.getBlockStatus.mockResolvedValue(mockStatus);
      
      const result = await service.isBlocked('client-123');
      
      expect(result).toEqual({
        blocked: true,
        remainingTime: 300000,
        blockReason: 'Rate limit exceeded',
      });
      
      expect(storage.getBlockStatus).toHaveBeenCalledWith('client-123', 'default');
    });
    
    it('should handle errors gracefully', async () => {
      storage.getBlockStatus.mockRejectedValue(new Error('Redis error'));
      
      const result = await service.isBlocked('client-123');
      
      expect(result).toEqual({ blocked: false });
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

describe('Block Duration Integration', () => {
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
  
  describe('Block Duration Behavior', () => {
    it('should block client after exceeding rate limit', async () => {
      const clientId = 'test-client-' + Date.now();
      
      // Make requests to exceed limit (assuming limit is 5)
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', clientId)
          .send({ username: 'test', password: 'test' });
      }
      
      // Next request should be blocked
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', clientId)
        .send({ username: 'test', password: 'test' })
        .expect(429);
      
      expect(response.body).toHaveProperty('message');
      expect(response.headers).toHaveProperty('retry-after');
    });
    
    it('should unblock client after block duration expires', async () => {
      // This test would require waiting for the block duration to expire
      // or using a very short block duration for testing
      const clientId = 'test-client-unblock-' + Date.now();
      
      // Configure short block duration for testing
      // ... test implementation
    }, 30000); // Longer timeout for this test
  });
});
```

## Environment Configuration

```bash
# .env - Block Duration Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Block Duration Settings
THROTTLER_DEFAULT_BLOCK_DURATION=300000      # 5 minutes
THROTTLER_AUTH_BLOCK_DURATION=900000         # 15 minutes
THROTTLER_OTP_BLOCK_DURATION=1800000         # 30 minutes
THROTTLER_UPLOAD_BLOCK_DURATION=600000       # 10 minutes

# Progressive Blocking
ENABLE_PROGRESSIVE_BLOCKING=true
MAX_VIOLATIONS_TRACKING=10
VIOLATION_RESET_INTERVAL=86400000            # 24 hours

# Block Duration Strategy
BLOCK_DURATION_STRATEGY=progressive          # progressive, time-based, ip-based
ENABLE_VIOLATION_TRACKING=true
ENABLE_BLOCK_MONITORING=true

# Security Settings
ENABLE_MANUAL_UNBLOCK=true                   # Allow admin to unblock clients
LOG_BLOCK_EVENTS=true                        # Log all block/unblock events
ALERT_ON_HIGH_BLOCK_RATE=true               # Alert when block rate is high
```

## Best Practices

### 1. Block Duration Guidelines

- **Authentication endpoints**: 15-30 minutes
- **OTP/SMS endpoints**: 30 minutes - 2 hours
- **File uploads**: 5-10 minutes
- **General API**: 5-15 minutes
- **Public endpoints**: Consider no blocking (blockDuration: 0)

### 2. Progressive Blocking Strategy

```typescript
// Recommended progressive blocking intervals
const PROGRESSIVE_BLOCKS = {
  auth: [
    5 * 60 * 1000,      // 5 minutes (1st violation)
    15 * 60 * 1000,     // 15 minutes (2nd violation)
    60 * 60 * 1000,     // 1 hour (3rd violation)
    24 * 60 * 60 * 1000, // 24 hours (4th+ violations)
  ],
  otp: [
    30 * 60 * 1000,     // 30 minutes (1st violation)
    2 * 60 * 60 * 1000, // 2 hours (2nd violation)
    24 * 60 * 60 * 1000, // 24 hours (3rd+ violations)
  ],
};
```

### 3. Monitoring and Alerting

- Monitor block rates and patterns
- Alert on unusual blocking activity
- Track repeat offenders
- Provide admin tools for manual intervention
- Log all block/unblock events for audit

This comprehensive block duration configuration provides robust protection against abuse while maintaining good user experience for legitimate users.