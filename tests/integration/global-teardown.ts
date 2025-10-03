/**
 * @fileoverview Global teardown for integration tests
 *
 * This module handles cleanup after integration tests complete.
 * It ensures all test data is cleaned up from Redis.
 */

import { Redis } from 'ioredis';
import { TestConfigs } from '../shared/test-data';

export default async (): Promise<void> => {
  console.log('Cleaning up integration test environment...');

  // Create Redis client for cleanup
  const redis = new Redis({
    host: TestConfigs.INTEGRATION_REDIS.host,
    port: TestConfigs.INTEGRATION_REDIS.port,
    db: TestConfigs.INTEGRATION_REDIS.db,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: true
  });

  try {
    await redis.connect();
    
    // Clean all test data
    const keys = await redis.keys(`${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✓ Cleaned ${keys.length} test keys`);
    }
    
    // Clean any Redis Functions that might have been loaded during tests
    try {
      await redis.function('FLUSH');
      console.log('✓ Cleaned Redis Functions');
    } catch (error) {
      // Ignore errors if Redis Functions are not supported
      console.log('- Redis Functions cleanup skipped (not supported or already clean)');
    }
    
    console.log('✓ Integration test environment cleaned up');
  } catch (error) {
    console.error('✗ Failed to cleanup integration test environment:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await redis.quit();
  }
};