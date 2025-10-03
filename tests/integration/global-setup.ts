/**
 * @fileoverview Global setup for integration tests
 *
 * This module handles Redis connection setup and validation for integration tests.
 * It ensures Redis is available before running tests.
 */

import { Redis } from 'ioredis';
import { TestConfigs } from '../shared/test-data';

export default async (): Promise<void> => {
  console.log('Setting up integration test environment...');

  // Create Redis client for setup validation
  const redis = new Redis({
    host: TestConfigs.INTEGRATION_REDIS.host,
    port: TestConfigs.INTEGRATION_REDIS.port,
    db: TestConfigs.INTEGRATION_REDIS.db,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: true
  });

  try {
    // Test Redis connection
    await redis.connect();
    await redis.ping();
    
    console.log(`✓ Redis connection established at ${TestConfigs.INTEGRATION_REDIS.host}:${TestConfigs.INTEGRATION_REDIS.port}`);
    
    // Clean any existing test data
    const keys = await redis.keys(`${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✓ Cleaned ${keys.length} existing test keys`);
    }
    
    console.log('✓ Integration test environment ready');
  } catch (error) {
    console.error('✗ Failed to setup integration test environment:', error);
    throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await redis.quit();
  }
};