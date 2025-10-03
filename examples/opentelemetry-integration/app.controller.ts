/**
 * @fileoverview Example controller demonstrating throttling with OpenTelemetry observability
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller('api')
export class AppController {
  @Get('public')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  getPublicData() {
    return {
      message: 'Public data endpoint',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('auth/login')
  @Throttle({ strict: { limit: 5, ttl: 60000, blockDuration: 300000 } }) // 5 attempts per minute, block for 5 minutes
  login(@Body() credentials: { username: string; password: string }) {
    // Simulate login logic
    return {
      message: 'Login attempt processed',
      username: credentials.username,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('upload')
  @Throttle({ 
    upload: { 
      limit: 3, 
      ttl: 300000, // 5 minutes
      blockDuration: 600000 // Block for 10 minutes
    } 
  })
  uploadFile() {
    return {
      message: 'File upload processed',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  // No throttling for health checks
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}