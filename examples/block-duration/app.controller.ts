/**
 * @fileoverview Controller demonstrating block duration functionality
 */

import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('api')
@UseGuards(ThrottlerGuard)
export class AppController {

  /**
   * Default endpoint with 5-minute block duration
   * Limit: 10 requests per minute
   * Block: 5 minutes after limit exceeded
   */
  @Get('data')
  getData(): any {
    return {
      message: 'Data retrieved successfully',
      timestamp: new Date().toISOString(),
      rateLimit: {
        limit: 10,
        window: '1 minute',
        blockDuration: '5 minutes',
      },
    };
  }

  /**
   * Authentication with progressive block duration
   * Limit: 5 requests per 15 minutes
   * Block: Progressive (5min -> 15min -> 1hr -> 24hr)
   */
  @Post('auth/login')
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  login(@Body() credentials: { username: string; password: string }): any {
    // Simulate authentication logic
    if (!credentials.username || !credentials.password) {
      return {
        success: false,
        error: 'Username and password are required',
      };
    }

    // Simulate successful login
    return {
      success: true,
      token: 'jwt-token-example',
      message: 'Login successful',
      user: {
        id: 'user-123',
        username: credentials.username,
      },
      rateLimit: {
        limit: 5,
        window: '15 minutes',
        blockDuration: 'Progressive (5min -> 15min -> 1hr -> 24hr)',
      },
    };
  }

  /**
   * Password reset with strict block duration
   * Limit: 3 requests per hour
   * Block: Progressive (30min -> 2hr -> 24hr)
   */
  @Post('auth/reset-password')
  @Throttle({ otp: { limit: 3, ttl: 60 * 60 * 1000 } })
  resetPassword(@Body() data: { email: string }): any {
    if (!data.email) {
      return {
        success: false,
        error: 'Email is required',
      };
    }

    return {
      success: true,
      message: 'Password reset email sent',
      email: data.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Masked email
      rateLimit: {
        limit: 3,
        window: '1 hour',
        blockDuration: 'Progressive (30min -> 2hr -> 24hr)',
        warning: 'Very strict rate limiting applied',
      },
    };
  }

  /**
   * OTP sending with very strict block duration
   * Limit: 3 requests per hour
   * Block: Progressive (30min -> 2hr -> 24hr)
   */
  @Post('auth/send-otp')
  @Throttle({ otp: { limit: 3, ttl: 60 * 60 * 1000 } })
  sendOtp(@Body() data: { phone: string }): any {
    if (!data.phone) {
      return {
        success: false,
        error: 'Phone number is required',
      };
    }

    // Simulate OTP generation
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    return {
      success: true,
      message: 'OTP sent successfully',
      phone: data.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'), // Masked phone
      // In development, you might return the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
      rateLimit: {
        limit: 3,
        window: '1 hour',
        blockDuration: 'Progressive (30min -> 2hr -> 24hr)',
        warning: 'Abuse of this endpoint will result in extended blocks',
      },
    };
  }

  /**
   * File upload with moderate block duration
   * Limit: 5 requests per minute
   * Block: Progressive (5min -> 10min -> 15min -> 30min max)
   */
  @Post('upload')
  @Throttle({ upload: { limit: 5, ttl: 60 * 1000 } })
  uploadFile(@Body() file: { name: string; size: number; type: string }): any {
    if (!file.name) {
      return {
        success: false,
        error: 'File name is required',
      };
    }

    // Simulate file upload
    return {
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: 'file-' + Date.now(),
        name: file.name,
        size: file.size || 0,
        type: file.type || 'unknown',
        uploadedAt: new Date().toISOString(),
      },
      rateLimit: {
        limit: 5,
        window: '1 minute',
        blockDuration: 'Progressive (5min -> 10min -> 15min -> 30min max)',
      },
    };
  }

  /**
   * Public endpoint with no block duration (traditional rate limiting)
   * Limit: 100 requests per minute
   * Block: None (just rate limiting)
   */
  @Get('public')
  @Throttle({ public: { limit: 100, ttl: 60 * 1000 } })
  getPublicData(): any {
    return {
      message: 'Public data - no blocking applied',
      data: {
        news: 'Latest news updates',
        weather: '22°C, Sunny',
        time: new Date().toISOString(),
      },
      rateLimit: {
        limit: 100,
        window: '1 minute',
        blockDuration: 'None (traditional rate limiting only)',
        note: 'Requests are limited but no blocking is applied',
      },
    };
  }

  /**
   * Sensitive operation with multiple throttling strategies
   * Uses both auth and default throttlers
   */
  @Post('sensitive-operation')
  @Throttle([
    { name: 'auth', limit: 2, ttl: 15 * 60 * 1000 },
    { name: 'default', limit: 5, ttl: 60 * 1000 },
  ])
  sensitiveOperation(@Request() req: any, @Body() data: any): any {
    return {
      success: true,
      message: 'Sensitive operation completed',
      operationId: 'op-' + Date.now(),
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      rateLimit: {
        strategies: [
          {
            name: 'auth',
            limit: 2,
            window: '15 minutes',
            blockDuration: 'Progressive auth blocking',
          },
          {
            name: 'default',
            limit: 5,
            window: '1 minute',
            blockDuration: 'Progressive default blocking',
          },
        ],
        note: 'Multiple rate limiting strategies applied',
      },
    };
  }

  /**
   * Admin endpoint - higher limits, no blocking
   * This would typically be protected by authentication middleware
   */
  @Get('admin/stats')
  @Throttle({ default: { limit: 200, ttl: 60 * 1000, blockDuration: 0 } })
  getAdminStats(@Request() req: any): any {
    // In a real application, you'd check if user is admin
    return {
      success: true,
      stats: {
        totalUsers: 1000,
        activeUsers: 750,
        requestsToday: 50000,
        blockedClients: 25,
        averageResponseTime: '120ms',
      },
      rateLimit: {
        limit: 200,
        window: '1 minute',
        blockDuration: 'None (admin privileges)',
        note: 'Admin endpoints have higher limits and no blocking',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check endpoint - no throttling
   */
  @Get('health')
  @Throttle({ default: { limit: 0 } }) // Disable throttling
  healthCheck(): any {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      rateLimit: {
        applied: false,
        note: 'Health checks are not rate limited',
      },
    };
  }

  /**
   * Test endpoint to demonstrate block duration behavior
   * Use this to test the blocking functionality
   */
  @Get('test/block-demo')
  @Throttle({ default: { limit: 3, ttl: 30 * 1000 } }) // Very low limit for testing
  blockDemo(@Request() req: any): any {
    return {
      message: 'Block duration demo endpoint',
      clientId: req.ip,
      timestamp: new Date().toISOString(),
      rateLimit: {
        limit: 3,
        window: '30 seconds',
        blockDuration: 'Progressive blocking',
        instructions: [
          '1. Make 4+ requests quickly to trigger rate limiting',
          '2. Continue making requests to trigger blocking',
          '3. Wait for block duration to expire',
          '4. Observe progressive blocking behavior',
        ],
      },
    };
  }
}