/**
 * @fileoverview Global setup for E2E tests
 *
 * Ensures proper test environment initialization, Redis connectivity,
 * and performance monitoring setup for E2E test execution.
 */

import { Redis } from 'ioredis';
import { TestConfigs, TestConstants } from '../shared/test-data';
import { TestUtils } from '../shared/test-utils';

/**
 * Global setup function for E2E tests
 * 
 * This function runs once before all E2E tests to:
 * - Verify Redis connectivity
 * - Clean any existing test data
 * - Set up performance monitoring
 * - Validate test environment
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting E2E test environment setup...');
  
  const startTime = Date.now();
  let redis: Redis | undefined;

  try {
    // Create Redis connection for setup
    redis = new Redis({
      host: TestConfigs.E2E_REDIS.host,
      port: TestConfigs.E2E_REDIS.port,
      db: TestConfigs.E2E_REDIS.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      keyPrefix: TestConfigs.E2E_REDIS.keyPrefix,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });

    // Test Redis connectivity
    console.log('🔍 Testing Redis connectivity...');
    await redis.ping();
    console.log('✅ Redis connection successful');

    // Clean any existing test data
    console.log('🧹 Cleaning existing test data...');
    await TestUtils.cleanRedis(redis, `${TestConfigs.E2E_REDIS.keyPrefix}:*`);
    console.log('✅ Test data cleaned');

    // Verify Redis Functions availability (optional)
    try {
      await redis.eval('return "test"', 0);
      console.log('✅ Redis Lua script execution available');
    } catch (error) {
      console.warn('⚠️  Redis Lua script execution may be limited:', error);
    }

    // Set up performance monitoring
    const setupDuration = Date.now() - startTime;
    console.log(`⏱️  Setup completed in ${setupDuration}ms`);

    // Validate setup performance
    if (setupDuration > 10000) { // 10 seconds
      console.warn(`⚠️  Setup took ${setupDuration}ms, which is longer than expected`);
    }

    // Store setup metrics for later validation
    process.env.E2E_SETUP_DURATION = setupDuration.toString();
    process.env.E2E_SETUP_TIMESTAMP = Date.now().toString();

    console.log('🎉 E2E test environment setup complete');

  } catch (error) {
    console.error('❌ E2E test environment setup failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Redis connection refused. Please ensure Redis is running on:');
        console.error(`   Host: ${TestConfigs.E2E_REDIS.host}`);
        console.error(`   Port: ${TestConfigs.E2E_REDIS.port}`);
        console.error('   You can start Redis with: redis-server');
      } else if (error.message.includes('timeout')) {
        console.error('💡 Redis connection timeout. Check if Redis is responsive.');
      }
    }

    throw error;
  } finally {
    // Clean up setup Redis connection
    if (redis) {
      await redis.disconnect();
    }
  }
}

/**
 * Validate test environment requirements
 */
async function validateEnvironment(): Promise<void> {
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion < 16) {
    throw new Error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
  }

  // Check available memory
  const memoryUsage = process.memoryUsage();
  const availableMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
  
  if (availableMemoryMB < 100) {
    console.warn(`⚠️  Low memory available: ${availableMemoryMB.toFixed(2)}MB`);
  }

  // Check if running in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  if (isCI) {
    console.log('🤖 Running in CI environment');
    // Set stricter timeouts for CI
    process.env.E2E_TIMEOUT_MULTIPLIER = '2';
  }
}

/**
 * Set up performance monitoring
 */
function setupPerformanceMonitoring(): void {
  // Track test execution start time
  process.env.E2E_TESTS_START_TIME = Date.now().toString();

  // Set up memory monitoring
  const initialMemory = process.memoryUsage();
  process.env.E2E_INITIAL_MEMORY_USAGE = JSON.stringify(initialMemory);

  // Enable garbage collection monitoring if available
  if (global.gc) {
    console.log('🗑️  Garbage collection monitoring enabled');
  }

  // Set performance thresholds
  process.env.E2E_MAX_TOTAL_DURATION = '60000'; // 1 minute total
  process.env.E2E_MAX_INDIVIDUAL_TEST_DURATION = '20000'; // 20 seconds per test
  process.env.E2E_MAX_MEMORY_INCREASE_PERCENT = '50'; // 50% memory increase
}

// Run environment validation and performance setup
validateEnvironment();
setupPerformanceMonitoring();