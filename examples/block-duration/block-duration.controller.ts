/**
 * @fileoverview Admin controller for managing block duration and monitoring
 */

import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { BlockStatusService, BlockStatus, BlockedClient, BlockStatistics } from './block-status.service';

// Mock guards for the example - replace with your actual guards
const RolesGuard = class {};
const Roles = (role: string) => () => {};

@Controller('admin/throttler')
@UseGuards(RolesGuard)
export class BlockDurationController {
  
  constructor(private readonly blockStatusService: BlockStatusService) {}
  
  /**
   * Get block status for a specific client
   */
  @Get('status/:clientId')
  @Roles('admin')
  async getBlockStatus(
    @Param('clientId') clientId: string,
    @Query('throttler') throttlerName?: string,
  ): Promise<{
    success: boolean;
    data: BlockStatus & { clientId: string; throttlerName: string };
    timestamp: string;
  }> {
    const status = await this.blockStatusService.isBlocked(
      clientId, 
      throttlerName || 'default'
    );
    
    return {
      success: true,
      data: {
        clientId,
        throttlerName: throttlerName || 'default',
        ...status,
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get all currently blocked clients
   */
  @Get('blocked')
  @Roles('admin')
  async getBlockedClients(@Query('throttler') throttlerName?: string): Promise<{
    success: boolean;
    data: {
      total: number;
      clients: BlockedClient[];
      filteredBy?: string;
    };
    timestamp: string;
  }> {
    let blockedClients = await this.blockStatusService.getBlockedClients();
    
    // Filter by throttler if specified
    if (throttlerName) {
      blockedClients = blockedClients.filter(client => client.throttlerName === throttlerName);
    }
    
    return {
      success: true,
      data: {
        total: blockedClients.length,
        clients: blockedClients,
        ...(throttlerName && { filteredBy: throttlerName }),
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Manually unblock a client
   */
  @Post('unblock')
  @Roles('admin')
  async unblockClient(@Body() data: { 
    clientId: string; 
    throttlerName?: string; 
    reason?: string; 
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      clientId: string;
      throttlerName: string;
      reason?: string;
    };
    timestamp: string;
  }> {
    await this.blockStatusService.unblockClient(
      data.clientId, 
      data.throttlerName || 'default',
      data.reason
    );
    
    return {
      success: true,
      message: 'Client unblocked successfully',
      data: {
        clientId: data.clientId,
        throttlerName: data.throttlerName || 'default',
        reason: data.reason,
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get comprehensive block statistics
   */
  @Get('statistics')
  @Roles('admin')
  async getBlockStatistics(): Promise<{
    success: boolean;
    data: BlockStatistics & {
      summary: {
        totalCurrentlyBlocked: number;
        mostBlockedThrottler: string;
        averageBlockDurationMinutes: number;
        blocksLast24Hours: number;
      };
    };
    timestamp: string;
  }> {
    const stats = await this.blockStatusService.getBlockStatistics();
    
    // Calculate summary statistics
    const mostBlockedThrottler = Object.entries(stats.blocksByThrottler)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
    
    const averageBlockDurationMinutes = Math.round(stats.averageBlockDuration / (1000 * 60));
    
    const blocksLast24Hours = stats.recentBlocks.filter(
      block => block.blockedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;
    
    return {
      success: true,
      data: {
        ...stats,
        summary: {
          totalCurrentlyBlocked: stats.totalBlocked,
          mostBlockedThrottler,
          averageBlockDurationMinutes,
          blocksLast24Hours,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get violation history for a specific client
   */
  @Get('violations/:clientId')
  @Roles('admin')
  async getViolationHistory(
    @Param('clientId') clientId: string,
    @Query('throttler') throttlerName?: string,
  ): Promise<{
    success: boolean;
    data: {
      clientId: string;
      throttlerName: string;
      totalViolations: number;
      recentViolations: Array<{
        timestamp: Date;
        throttlerName: string;
        blockDuration: number;
      }>;
      nextBlockDuration: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
    timestamp: string;
  }> {
    const history = await this.blockStatusService.getViolationHistory(
      clientId,
      throttlerName || 'default'
    );
    
    // Calculate risk level based on violations
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (history.totalViolations >= 10) riskLevel = 'critical';
    else if (history.totalViolations >= 5) riskLevel = 'high';
    else if (history.totalViolations >= 2) riskLevel = 'medium';
    
    return {
      success: true,
      data: {
        clientId,
        throttlerName: throttlerName || 'default',
        ...history,
        riskLevel,
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Clear violation history for a client (admin function)
   */
  @Post('violations/clear')
  @Roles('admin')
  async clearViolationHistory(@Body() data: {
    clientId: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      clientId: string;
      reason?: string;
    };
    timestamp: string;
  }> {
    await this.blockStatusService.clearViolationHistory(data.clientId, data.reason);
    
    return {
      success: true,
      message: 'Violation history cleared successfully',
      data: {
        clientId: data.clientId,
        reason: data.reason,
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get block duration configuration for all throttlers
   */
  @Get('configuration')
  @Roles('admin')
  async getConfiguration(): Promise<{
    success: boolean;
    data: {
      throttlers: Array<{
        name: string;
        limit: number;
        ttl: number;
        blockDuration: number | string;
        description: string;
      }>;
      strategies: {
        current: string;
        available: string[];
        description: string;
      };
    };
    timestamp: string;
  }> {
    // This would typically come from your configuration service
    const configuration = {
      throttlers: [
        {
          name: 'default',
          limit: 10,
          ttl: 60 * 1000,
          blockDuration: 'Progressive (2min -> 4min -> 8min -> 15min max)',
          description: 'General API endpoints',
        },
        {
          name: 'auth',
          limit: 5,
          ttl: 15 * 60 * 1000,
          blockDuration: 'Progressive (5min -> 15min -> 1hr -> 24hr)',
          description: 'Authentication endpoints',
        },
        {
          name: 'otp',
          limit: 3,
          ttl: 60 * 60 * 1000,
          blockDuration: 'Progressive (30min -> 2hr -> 24hr)',
          description: 'OTP and SMS endpoints',
        },
        {
          name: 'upload',
          limit: 5,
          ttl: 60 * 1000,
          blockDuration: 'Progressive (5min -> 10min -> 15min -> 30min max)',
          description: 'File upload endpoints',
        },
        {
          name: 'public',
          limit: 100,
          ttl: 60 * 1000,
          blockDuration: 0,
          description: 'Public endpoints (no blocking)',
        },
      ],
      strategies: {
        current: 'Progressive Block Strategy',
        available: [
          'Progressive Block Strategy',
          'Time-Based Block Strategy',
          'IP-Based Block Strategy',
          'Fixed Block Strategy',
        ],
        description: 'Progressive blocking increases block duration for repeat violations',
      },
    };
    
    return {
      success: true,
      data: configuration,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get real-time block monitoring data
   */
  @Get('monitoring')
  @Roles('admin')
  async getMonitoringData(): Promise<{
    success: boolean;
    data: {
      currentBlocks: number;
      blocksLastHour: number;
      blocksLastDay: number;
      topThrottlers: Array<{
        name: string;
        blocks: number;
        percentage: number;
      }>;
      recentActivity: Array<{
        timestamp: Date;
        event: 'blocked' | 'unblocked' | 'violation';
        clientId: string;
        throttlerName: string;
        details?: string;
      }>;
      alerts: Array<{
        level: 'info' | 'warning' | 'error';
        message: string;
        timestamp: Date;
      }>;
    };
    timestamp: string;
  }> {
    const stats = await this.blockStatusService.getBlockStatistics();
    
    // Calculate monitoring metrics
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const blocksLastHour = stats.recentBlocks.filter(
      block => block.blockedAt.getTime() > oneHourAgo
    ).length;
    
    const blocksLastDay = stats.recentBlocks.filter(
      block => block.blockedAt.getTime() > oneDayAgo
    ).length;
    
    // Top throttlers by block count
    const totalBlocks = Object.values(stats.blocksByThrottler).reduce((a, b) => a + b, 0);
    const topThrottlers = Object.entries(stats.blocksByThrottler)
      .map(([name, blocks]) => ({
        name,
        blocks,
        percentage: totalBlocks > 0 ? Math.round((blocks / totalBlocks) * 100) : 0,
      }))
      .sort((a, b) => b.blocks - a.blocks);
    
    // Generate alerts based on current state
    const alerts: Array<{
      level: 'info' | 'warning' | 'error';
      message: string;
      timestamp: Date;
    }> = [];
    
    if (stats.totalBlocked > 50) {
      alerts.push({
        level: 'error',
        message: `High number of blocked clients: ${stats.totalBlocked}`,
        timestamp: new Date(),
      });
    } else if (stats.totalBlocked > 20) {
      alerts.push({
        level: 'warning',
        message: `Elevated number of blocked clients: ${stats.totalBlocked}`,
        timestamp: new Date(),
      });
    }
    
    if (blocksLastHour > 10) {
      alerts.push({
        level: 'warning',
        message: `High blocking rate: ${blocksLastHour} blocks in the last hour`,
        timestamp: new Date(),
      });
    }
    
    // Mock recent activity (in a real implementation, this would come from logs)
    const recentActivity = stats.recentBlocks.slice(0, 10).map(block => ({
      timestamp: block.blockedAt,
      event: 'blocked' as const,
      clientId: block.clientId,
      throttlerName: block.throttlerName,
      details: `Blocked for ${Math.round(block.duration / (1000 * 60))} minutes`,
    }));
    
    return {
      success: true,
      data: {
        currentBlocks: stats.totalBlocked,
        blocksLastHour,
        blocksLastDay,
        topThrottlers,
        recentActivity,
        alerts,
      },
      timestamp: new Date().toISOString(),
    };
  }
}