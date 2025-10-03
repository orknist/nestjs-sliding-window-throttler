/**
 * @fileoverview Advanced controller example with multiple throttling strategies
 */

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller()
@UseGuards(ThrottlerGuard)
export class AppController {
  /**
   * Default throttling (100 requests per minute)
   */
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Authentication endpoint with strict throttling
   */
  @Post('auth/login')
  @Throttle({ auth: { limit: 5, ttl: 15 * 60 * 1000 } })
  login(@Body() credentials: any): string {
    // Login logic here
    return 'Login successful!';
  }

  /**
   * OTP sending with very strict throttling
   */
  @Post('auth/send-otp')
  @Throttle({ otp: { limit: 3, ttl: 60 * 60 * 1000 } })
  sendOtp(@Body() data: any): string {
    // OTP sending logic here
    return 'OTP sent successfully!';
  }

  /**
   * File upload with moderate throttling
   */
  @Post('upload')
  @Throttle({ upload: { limit: 5, ttl: 60 * 1000 } })
  uploadFile(@Body() file: any): string {
    // File upload logic here
    return 'File uploaded successfully!';
  }

  /**
   * Multiple throttling strategies on single endpoint
   */
  @Post('sensitive-operation')
  @Throttle({ 
    auth: { limit: 2, ttl: 15 * 60 * 1000 }, // 2 per 15 minutes for auth
    default: { limit: 10, ttl: 60 * 1000 },  // 10 per minute overall
  })
  sensitiveOperation(): string {
    return 'Sensitive operation completed!';
  }

  /**
   * Health check endpoint - no throttling
   */
  @Get('health')
  @Throttle({ default: { limit: 0 } }) // Disable throttling
  healthCheck(): string {
    return 'OK';
  }

  /**
   * Admin endpoint - throttling can be skipped via skipIf in module config
   */
  @Get('admin/stats')
  getAdminStats(): string {
    return 'Admin statistics';
  }
}