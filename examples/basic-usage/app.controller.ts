/**
 * @fileoverview Example controller demonstrating throttling usage
 */

import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class AppController {
  /**
   * Default throttling (10 requests per minute)
   */
  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Strict throttling (5 requests per minute)
   */
  @Get('strict')
  @Throttle({ strict: { limit: 5, ttl: 60 * 1000 } })
  getStrict(): string {
    return 'This endpoint has strict rate limiting!';
  }

  /**
   * Custom throttling for sensitive operations
   */
  @Post('sensitive')
  @Throttle({ 
    sensitive: { 
      limit: 2, 
      ttl: 60 * 1000, // 1 minute
      blockDuration: 15 * 60 * 1000, // Block for 15 minutes
    } 
  })
  postSensitive(): string {
    return 'Sensitive operation completed!';
  }

  /**
   * Skip throttling for this endpoint
   */
  @Get('public')
  @Throttle({ default: { limit: 0 } }) // Disable throttling
  getPublic(): string {
    return 'This endpoint is not throttled!';
  }
}