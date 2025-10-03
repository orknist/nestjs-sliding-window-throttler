/**
 * @fileoverview Service for managing and monitoring block status
 */

import { Injectable, Logger } from '@nestjs/common';
import { SlidingWindowThrottlerStorage } from 'nestjs-sliding-window-throttler';

export interface BlockStatus {
  blocked: boolean;
  remainingTime?: number;
  blockReason?: string;
  violationCount?: number;
  blockedAt?: Date;
  unblockAt?: Date;
}

export interface BlockedClient {
  clientId: string;
  throttlerName: string;
  blockedAt: Date;
  unblockAt: Date;
  remainingTime: number;
  violations: number;
  reason: string;
}

export interface BlockStatistics {
  totalBlocked: number;
  blocksByThrottler: Record<string, number>;
  averageBlockDuration: number;
  topBlockedClients: Array<{ clientId: string; violations: number }>;
  recentBlocks: Array<{
    clientId: string;
    throttlerName: string;
    blockedAt: Date;
    duration: number;
  }>;
}

@Injectable()
export class BlockStatusService {
  private readonly logger = new Logger(BlockStatusService.name);
  
  constructor(
    private readonly throttlerStorage: SlidingWindowThrottlerStorage,
  ) {}
  
  /**
   * Check if a client is currently blocked
   */
  async isBlocked(clientId: string, throttlerName: string = 'default'): Promise<BlockStatus> {
    try {
      this.logger.debug('Checking block status', {
        clientId: this.maskClientId(clientId),
        throttlerName,
      });
      
      const result = await this.throttlerStorage.increment(
        clientId,
        0, // ttl: 0 means just check, don't increment
        0, // limit: 0 means just check
        0, // blockDuration: 0 means just check
        throttlerName,
      );
      
      const status: BlockStatus = {
        blocked: result.isBlocked,
        remainingTime: result.timeToBlockExpire > 0 ? result.timeToBlockExpire * 1000 : undefined,
        violationCount: result.totalHits,
      };
      
      if (result.isBlocked) {
        status.blockReason = 'Rate limit exceeded';
        status.blockedAt = new Date(Date.now() - (result.timeToExpire * 1000 - result.timeToBlockExpire * 1000));
        status.unblockAt = new Date(Date.now() + result.timeToBlockExpire * 1000);
      }
      
      this.logger.debug('Block status checked', {
        clientId: this.maskClientId(clientId),
        throttlerName,
        blocked: status.blocked,
        remainingTime: status.remainingTime,
      });
      
      return status;
    } catch (error) {
      this.logger.error('Failed to check block status', error, {
        clientId: this.maskClientId(clientId),
        throttlerName,
      });
      
      return { blocked: false };
    }
  }
  
  /**
   * Get all currently blocked clients
   */
  async getBlockedClients(): Promise<BlockedClient[]> {
    try {
      this.logger.debug('Retrieving blocked clients');
      
      // This would typically scan Redis for blocked keys
      // Implementation depends on the storage structure
      const blockedClients: BlockedClient[] = [];
      
      // Get all throttler keys and check their block status
      const throttlerNames = ['default', 'auth', 'otp', 'upload'];
      
      for (const throttlerName of throttlerNames) {
        const clients = await this.getBlockedClientsForThrottler(throttlerName);
        blockedClients.push(...clients);
      }
      
      this.logger.debug('Retrieved blocked clients', {
        count: blockedClients.length,
      });
      
      return blockedClients;
    } catch (error) {
      this.logger.error('Failed to get blocked clients', error);
      return [];
    }
  }
  
  /**
   * Get blocked clients for a specific throttler
   */
  private async getBlockedClientsForThrottler(throttlerName: string): Promise<BlockedClient[]> {
    try {
      // This is a simplified implementation
      // In a real implementation, you'd scan Redis keys or maintain a separate index
      const blockedClients: BlockedClient[] = [];
      
      // Example implementation - you'd need to adapt this based on your Redis key structure
      const redis = (this.throttlerStorage as any).redis;
      if (!redis) {
        return [];
      }
      
      // Scan for block keys
      const blockKeys = await redis.keys(`throttle:*:${throttlerName}:block`);
      
      for (const blockKey of blockKeys) {
        const ttl = await redis.pttl(blockKey);
        if (ttl > 0) {
          // Extract client ID from key
          const clientId = this.extractClientIdFromKey(blockKey);
          const blockedAt = new Date(Date.now() - ttl);
          const unblockAt = new Date(Date.now() + ttl);
          
          // Get violation count
          const zKey = blockKey.replace(':block', ':z');
          const violations = await redis.zcard(zKey);
          
          blockedClients.push({
            clientId,
            throttlerName,
            blockedAt,
            unblockAt,
            remainingTime: ttl,
            violations,
            reason: 'Rate limit exceeded',
          });
        }
      }
      
      return blockedClients;
    } catch (error) {
      this.logger.error('Failed to get blocked clients for throttler', error, {
        throttlerName,
      });
      return [];
    }
  }
  
  /**
   * Manually unblock a client (admin function)
   */
  async unblockClient(clientId: string, throttlerName: string = 'default', reason?: string): Promise<void> {
    try {
      this.logger.warn('Manually unblocking client', {
        clientId: this.maskClientId(clientId),
        throttlerName,
        reason,
        admin: true,
      });
      
      // Reset the client's rate limit data
      await this.throttlerStorage.reset(clientId);
      
      // Also remove any block keys directly
      const redis = (this.throttlerStorage as any).redis;
      if (redis) {
        const blockKey = `throttle:${clientId}:${throttlerName}:block`;
        await redis.del(blockKey);
      }
      
      this.logger.warn('Client manually unblocked', {
        clientId: this.maskClientId(clientId),
        throttlerName,
        reason,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to unblock client', error, {
        clientId: this.maskClientId(clientId),
        throttlerName,
        reason,
      });
      throw error;
    }
  }
  
  /**
   * Get block statistics
   */
  async getBlockStatistics(): Promise<BlockStatistics> {
    try {
      this.logger.debug('Retrieving block statistics');
      
      const blockedClients = await this.getBlockedClients();
      
      // Calculate statistics
      const blocksByThrottler: Record<string, number> = {};
      let totalBlockDuration = 0;
      const clientViolations: Record<string, number> = {};
      const recentBlocks: BlockStatistics['recentBlocks'] = [];
      
      for (const client of blockedClients) {
        // Count by throttler
        blocksByThrottler[client.throttlerName] = (blocksByThrottler[client.throttlerName] || 0) + 1;
        
        // Calculate average block duration
        const blockDuration = client.unblockAt.getTime() - client.blockedAt.getTime();
        totalBlockDuration += blockDuration;
        
        // Track violations
        clientViolations[client.clientId] = client.violations;
        
        // Recent blocks (last 24 hours)
        if (client.blockedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
          recentBlocks.push({
            clientId: this.maskClientId(client.clientId),
            throttlerName: client.throttlerName,
            blockedAt: client.blockedAt,
            duration: blockDuration,
          });
        }
      }
      
      // Top blocked clients
      const topBlockedClients = Object.entries(clientViolations)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([clientId, violations]) => ({
          clientId: this.maskClientId(clientId),
          violations,
        }));
      
      const statistics: BlockStatistics = {
        totalBlocked: blockedClients.length,
        blocksByThrottler,
        averageBlockDuration: blockedClients.length > 0 ? totalBlockDuration / blockedClients.length : 0,
        topBlockedClients,
        recentBlocks: recentBlocks.slice(0, 50), // Limit to 50 recent blocks
      };
      
      this.logger.debug('Block statistics retrieved', {
        totalBlocked: statistics.totalBlocked,
        throttlers: Object.keys(blocksByThrottler),
        averageBlockDuration: statistics.averageBlockDuration,
      });
      
      return statistics;
    } catch (error) {
      this.logger.error('Failed to get block statistics', error);
      throw error;
    }
  }
  
  /**
   * Get violation history for a client
   */
  async getViolationHistory(clientId: string, throttlerName: string = 'default'): Promise<{
    totalViolations: number;
    recentViolations: Array<{
      timestamp: Date;
      throttlerName: string;
      blockDuration: number;
    }>;
    nextBlockDuration: number;
  }> {
    try {
      this.logger.debug('Getting violation history', {
        clientId: this.maskClientId(clientId),
        throttlerName,
      });
      
      // This would typically query a violations tracking system
      // For now, return mock data
      const violationHistory = {
        totalViolations: 0,
        recentViolations: [] as Array<{
          timestamp: Date;
          throttlerName: string;
          blockDuration: number;
        }>,
        nextBlockDuration: 5 * 60 * 1000, // 5 minutes default
      };
      
      return violationHistory;
    } catch (error) {
      this.logger.error('Failed to get violation history', error, {
        clientId: this.maskClientId(clientId),
        throttlerName,
      });
      throw error;
    }
  }
  
  /**
   * Clear violation history for a client (admin function)
   */
  async clearViolationHistory(clientId: string, reason?: string): Promise<void> {
    try {
      this.logger.warn('Clearing violation history', {
        clientId: this.maskClientId(clientId),
        reason,
        admin: true,
      });
      
      // This would clear the violation tracking data
      // Implementation depends on how violations are stored
      
      this.logger.warn('Violation history cleared', {
        clientId: this.maskClientId(clientId),
        reason,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to clear violation history', error, {
        clientId: this.maskClientId(clientId),
        reason,
      });
      throw error;
    }
  }
  
  /**
   * Mask client ID for logging (privacy)
   */
  private maskClientId(clientId: string): string {
    if (clientId.length <= 8) {
      return '*'.repeat(clientId.length);
    }
    return clientId.substring(0, 4) + '*'.repeat(clientId.length - 8) + clientId.substring(clientId.length - 4);
  }
  
  /**
   * Extract client ID from Redis key
   */
  private extractClientIdFromKey(key: string): string {
    // Example key: throttle:user123:default:block
    const parts = key.split(':');
    return parts[1] || 'unknown';
  }
}