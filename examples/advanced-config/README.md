# Advanced Configuration Example

This example demonstrates advanced configuration scenarios including async configuration, multiple throttlers, and production-ready setups using the simplified throttler package.

## Advanced Configuration

### 1. Async Configuration with Environment Variables

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { 
  SlidingWindowThrottlerModule, 
  SlidingWindowThrottlerStorage,
  FailureStrategy 
} from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    // Async configuration with validation
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Validate required environment variables
        const requiredVars = ['REDIS_HOST', 'REDIS_PORT'];
        for (const varName of requiredVars) {
          if (!configService.get(varName)) {
            throw new Error(`Missing required environment variable: ${varName}`);
          }
        }

        return {
          redis: {
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
            keyPrefix: configService.get('REDIS_KEY_PREFIX', 'myapp:throttle'),
          },
          
          // Production-ready settings
          failureStrategy: configService.get('NODE_ENV') === 'production' 
            ? FailureStrategy.FAIL_CLOSED 
            : FailureStrategy.FAIL_OPEN,
          enableDebugLogging: configService.get('NODE_ENV') === 'development',
          maxWindowSize: configService.get('MAX_WINDOW_SIZE', 1000),
          enableRedisFunctions: configService.get('ENABLE_REDIS_FUNCTIONS', 'true') === 'true',
        };
      },
      inject: [ConfigService],
    }),
    
    // Multiple named throttlers
    ThrottlerModule.forRootAsync({
      imports: [SlidingWindowThrottlerModule, ConfigModule],
      useFactory: (storage: SlidingWindowThrottlerStorage, configService: ConfigService) => ({
        throttlers: [
          // General API throttling
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
          
          // OTP sending (very strict)
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
          
          // Admin operations (more lenient)
          {
            name: 'admin',
            ttl: 60 * 1000, // 1 minute
            limit: configService.get('THROTTLER_ADMIN_LIMIT', 200),
            blockDuration: 0, // No blocking for admin
          },
        ],
        storage,
        
        // Advanced skip logic
        skipIf: (context) => {
          const request = context.switchToHttp().getRequest();
          
          // Skip for admin users
          if (request.user?.role === 'admin') {
            return true;
          }
          
          // Skip for health checks
          if (request.path === '/health' || request.path === '/metrics') {
            return true;
          }
          
          // Skip for internal services
          const userAgent = request.get('user-agent') || '';
          if (userAgent.includes('internal-service')) {
            return true;
          }
          
          // Skip for whitelisted IPs
          const whitelistedIPs = configService.get('THROTTLER_WHITELIST_IPS', '').split(',');
          if (whitelistedIPs.includes(request.ip)) {
            return true;
          }
          
          return false;
        },
        
        // Ignore certain user agents
        ignoreUserAgents: [
          /googlebot/i,
          /bingbot/i,
          /health-check/i,
          /monitoring/i,
        ],
        
        // Custom error response
        errorMessage: 'Rate limit exceeded. Please try again later.',
        
        // Custom headers
        getTracker: (req) => {
          // Use different tracking strategies
          if (req.user?.id) {
            return `user:${req.user.id}`;
          }
          
          if (req.headers['x-api-key']) {
            return `api:${req.headers['x-api-key']}`;
          }
          
          return req.ip;
        },
      }),
      inject: [SlidingWindowThrottlerStorage, ConfigService],
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

### 2. Environment Configuration

```bash
# .env.production
NODE_ENV=production

# Required Redis Configuration
REDIS_HOST=redis.example.com
REDIS_PORT=6379

# Optional Redis Configuration
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
REDIS_KEY_PREFIX=myapp:throttle

# Throttler Configuration
FAILURE_STRATEGY=fail-closed
ENABLE_REDIS_FUNCTIONS=true
MAX_WINDOW_SIZE=1000
ENABLE_DEBUG_LOGGING=false

# Rate Limits (used in ThrottlerModule configuration)
THROTTLER_DEFAULT_LIMIT=100
THROTTLER_AUTH_LIMIT=5
THROTTLER_OTP_LIMIT=3
THROTTLER_UPLOAD_LIMIT=5
THROTTLER_ADMIN_LIMIT=200

# Block Durations (in milliseconds)
THROTTLER_DEFAULT_BLOCK_DURATION=0
THROTTLER_AUTH_BLOCK_DURATION=900000    # 15 minutes
THROTTLER_OTP_BLOCK_DURATION=1800000    # 30 minutes
THROTTLER_UPLOAD_BLOCK_DURATION=300000  # 5 minutes
```

## Advanced Controller Usage

```typescript
import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Roles, RolesGuard } from './guards';

@Controller('api')
@UseGuards(ThrottlerGuard, RolesGuard)
export class AdvancedController {
  
  /**
   * Default throttling for general API endpoints
   */
  @Get('data')
  async getData(): Promise<any> {
    return { data: 'General API data' };
  }
  
  /**
   * Authentication with strict throttling
   */
  @Post('auth/login')
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  async login(@Body() credentials: any): Promise<any> {
    // Authentication logic
    return { token: 'jwt-token', expiresIn: 3600 };
  }
  
  /**
   * OTP sending with very strict throttling
   */
  @Post('auth/send-otp')
  @Throttle({ otp: { limit: 3, ttl: 60 * 60 * 1000 } })
  async sendOtp(@Body() data: { email: string }): Promise<any> {
    // OTP sending logic
    return { message: 'OTP sent successfully' };
  }
  
  /**
   * File upload with moderate throttling
   */
  @Post('upload')
  @Throttle({ upload: { limit: 5, ttl: 60 * 1000 } })
  async uploadFile(@Body() file: any): Promise<any> {
    // File upload logic
    return { fileId: 'file-123', status: 'uploaded' };
  }
  
  /**
   * Multiple throttling strategies
   */
  @Post('sensitive-operation')
  @Throttle([
    { name: 'auth', limit: 2, ttl: 15 * 60 * 1000 },
    { name: 'default', limit: 10, ttl: 60 * 1000 },
  ])
  async sensitiveOperation(@Request() req: any): Promise<any> {
    return { 
      message: 'Operation completed',
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Admin endpoints with higher limits
   */
  @Get('admin/stats')
  @Roles('admin')
  @Throttle({ admin: { limit: 200, ttl: 60 * 1000 } })
  async getAdminStats(): Promise<any> {
    return {
      totalUsers: 1000,
      activeUsers: 750,
      requestsToday: 50000,
    };
  }
  
  /**
   * Health check - no throttling
   */
  @Get('health')
  @Throttle({ default: { limit: 0 } }) // Disable throttling
  healthCheck(): any {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
  
  /**
   * Dynamic throttling based on user tier
   */
  @Get('premium-data')
  @Throttle((context) => {
    const request = context.switchToHttp().getRequest();
    const userTier = request.user?.tier || 'basic';
    
    switch (userTier) {
      case 'premium':
        return { limit: 1000, ttl: 60 * 1000 };
      case 'pro':
        return { limit: 500, ttl: 60 * 1000 };
      default:
        return { limit: 100, ttl: 60 * 1000 };
    }
  })
  async getPremiumData(@Request() req: any): Promise<any> {
    return {
      data: 'Premium data',
      userTier: req.user?.tier,
      allowedRequests: req.user?.tier === 'premium' ? 1000 : 100,
    };
  }
}
```

## Custom Logger Integration

### Health Check Service with Custom Logging

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  Logger as ThrottlerLogger,
  ConsoleLogger 
} from 'nestjs-sliding-window-throttler';

// Custom logger for health monitoring
class HealthMonitorLogger implements ThrottlerLogger {
  private readonly logger = new Logger('ThrottlerHealth');
  
  debug(message: string, context?: Record<string, any>): void {
    this.logger.debug(message, context);
  }
  
  info(message: string, context?: Record<string, any>): void {
    this.logger.log(message, context);
    
    // Custom health monitoring logic
    if (context?.operation === 'increment' && context?.current) {
      this.checkThresholds(context);
    }
  }
  
  warn(message: string, context?: Record<string, any>): void {
    this.logger.warn(message, context);
  }
  
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.logger.error(message, error?.stack, context);
    
    // Alert on Redis connection issues
    if (error?.name === 'RedisConnectionError') {
      this.alertRedisIssue(error, context);
    }
  }
  
  private checkThresholds(context: Record<string, any>): void {
    const utilizationRate = context.current / context.limit;
    
    if (utilizationRate > 0.8) {
      this.logger.warn('High throttler utilization', {
        key: context.key,
        utilization: `${Math.round(utilizationRate * 100)}%`,
        current: context.current,
        limit: context.limit,
      });
    }
  }
  
  private alertRedisIssue(error: Error, context?: Record<string, any>): void {
    // Implement your alerting logic here
    // e.g., send to monitoring service, Slack, etc.
    this.logger.error('ALERT: Redis connection issue detected', {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

@Injectable()
export class ThrottlerHealthService {
  private readonly logger = new Logger(ThrottlerHealthService.name);
  
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck(): Promise<void> {
    try {
      // Simple health check by attempting a Redis operation
      // The custom logger will capture any issues
      this.logger.log('Throttler health check completed');
    } catch (error) {
      this.logger.error('Health check failed', error);
    }
  }
}
```

## Production Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY dist/ ./dist/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=secure-password
      - FAILURE_STRATEGY=fail-closed
      - ENABLE_DEBUG_LOGGING=false
    depends_on:
      - redis
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass secure-password --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Environment Variables for Production

```bash
# .env.production
NODE_ENV=production

# Redis Configuration
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
REDIS_KEY_PREFIX=myapp:throttle

# Throttler Configuration
FAILURE_STRATEGY=fail-closed
ENABLE_REDIS_FUNCTIONS=true
MAX_WINDOW_SIZE=1000
ENABLE_DEBUG_LOGGING=false
```

## Performance Tuning

### Redis Optimization

```bash
# Basic Redis optimization for production
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET save "900 1 300 10 60 10000"

# Check Redis Functions support
redis-cli FUNCTION LIST
```

### Configuration Validation

```typescript
// config-validation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createConfig, validateConfig, getConfigSummary } from 'nestjs-sliding-window-throttler';

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);
  
  validateThrottlerConfig(): void {
    try {
      const config = createConfig();
      const { isValid, warnings } = validateConfig(config);
      
      this.logger.log('Throttler configuration loaded');
      this.logger.log(getConfigSummary(config));
      
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          this.logger.warn(`Configuration warning: ${warning}`);
        });
      }
      
      if (!isValid) {
        throw new Error('Invalid throttler configuration');
      }
    } catch (error) {
      this.logger.error('Failed to validate throttler configuration', error);
      throw error;
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Configuration Validation:**
   ```typescript
   import { createConfig, validateConfig } from 'nestjs-sliding-window-throttler';
   
   const config = createConfig();
   const { isValid, warnings } = validateConfig(config);
   console.log('Warnings:', warnings);
   ```

2. **Redis Connection Issues:**
   ```bash
   # Test Redis connectivity
   redis-cli -h your-redis-host -p 6379 ping
   
   # Check Redis version for Functions support
   redis-cli INFO server | grep redis_version
   ```

3. **Debug Logging:**
   ```bash
   # Enable debug logging
   ENABLE_DEBUG_LOGGING=true
   
   # Check logs for throttler operations
   ```

This advanced configuration provides production-ready rate limiting with proper error handling, configuration validation, and custom logging integration.