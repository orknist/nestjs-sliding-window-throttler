/**
 * @fileoverview Global teardown for E2E tests
 *
 * Ensures proper cleanup, performance validation, and resource management
 * after E2E test execution completes.
 */

import { Redis } from 'ioredis';
import { TestConfigs } from '../shared/test-data';
import { TestUtils } from '../shared/test-utils';

/**
 * Global teardown function for E2E tests
 * 
 * This function runs once after all E2E tests to:
 * - Clean up test data
 * - Validate performance metrics
 * - Check for resource leaks
 * - Generate performance report
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting E2E test environment cleanup...');
  
  const teardownStartTime = Date.now();
  let redis: Redis | undefined;

  try {
    // Create Redis connection for cleanup
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

    // Clean up all test data
    console.log('🗑️  Cleaning up test data...');
    await TestUtils.cleanRedis(redis, `${TestConfigs.E2E_REDIS.keyPrefix}:*`);
    
    // Verify cleanup
    const remainingKeys = await redis.keys(`${TestConfigs.E2E_REDIS.keyPrefix}:*`);
    if (remainingKeys.length > 0) {
      console.warn(`⚠️  ${remainingKeys.length} test keys remain after cleanup`);
    } else {
      console.log('✅ All test data cleaned successfully');
    }

    // Validate performance metrics
    await validatePerformanceMetrics();

    // Check for resource leaks
    await checkResourceLeaks();

    // Generate performance report
    generatePerformanceReport();

    const teardownDuration = Date.now() - teardownStartTime;
    console.log(`⏱️  Teardown completed in ${teardownDuration}ms`);
    console.log('🎉 E2E test environment cleanup complete');

  } catch (error) {
    console.error('❌ E2E test environment cleanup failed:', error);
    
    // Don't throw error in teardown to avoid masking test failures
    console.error('⚠️  Continuing despite cleanup errors...');
  } finally {
    // Always disconnect Redis
    if (redis) {
      await redis.disconnect();
    }
  }
}

/**
 * Validate performance metrics against thresholds
 */
async function validatePerformanceMetrics(): Promise<void> {
  console.log('📊 Validating performance metrics...');

  try {
    // Check total test execution time
    const startTime = parseInt(process.env.E2E_TESTS_START_TIME || '0', 10);
    const maxDuration = parseInt(process.env.E2E_MAX_TOTAL_DURATION || '60000', 10);
    
    if (startTime > 0) {
      const totalDuration = Date.now() - startTime;
      
      if (totalDuration > maxDuration) {
        console.warn(`⚠️  E2E tests took ${totalDuration}ms, exceeding limit of ${maxDuration}ms`);
      } else {
        console.log(`✅ E2E tests completed in ${totalDuration}ms (within ${maxDuration}ms limit)`);
      }
      
      // Store final metrics
      process.env.E2E_TOTAL_DURATION = totalDuration.toString();
    }

    // Check setup performance
    const setupDuration = parseInt(process.env.E2E_SETUP_DURATION || '0', 10);
    if (setupDuration > 10000) {
      console.warn(`⚠️  Setup took ${setupDuration}ms, consider optimizing`);
    }

  } catch (error) {
    console.warn('⚠️  Could not validate performance metrics:', error);
  }
}

/**
 * Check for resource leaks
 */
async function checkResourceLeaks(): Promise<void> {
  console.log('🔍 Checking for resource leaks...');

  try {
    // Check memory usage
    const currentMemory = process.memoryUsage();
    const initialMemoryStr = process.env.E2E_INITIAL_MEMORY_USAGE;
    
    if (initialMemoryStr) {
      const initialMemory = JSON.parse(initialMemoryStr) as NodeJS.MemoryUsage;
      const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      const maxIncreasePercent = parseInt(process.env.E2E_MAX_MEMORY_INCREASE_PERCENT || '50', 10);
      
      if (memoryIncreasePercent > maxIncreasePercent) {
        console.warn(`⚠️  Memory usage increased by ${memoryIncreasePercent.toFixed(2)}%, exceeding ${maxIncreasePercent}% limit`);
        console.warn(`   Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.warn(`   Current: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.warn(`   Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      } else {
        console.log(`✅ Memory usage increase: ${memoryIncreasePercent.toFixed(2)}% (within ${maxIncreasePercent}% limit)`);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️  Forced garbage collection');
    }

    // Check for open handles (Node.js specific)
    const activeHandles = (process as any)._getActiveHandles?.() || [];
    const activeRequests = (process as any)._getActiveRequests?.() || [];
    
    if (activeHandles.length > 0 || activeRequests.length > 0) {
      console.warn(`⚠️  Potential resource leaks detected:`);
      console.warn(`   Active handles: ${activeHandles.length}`);
      console.warn(`   Active requests: ${activeRequests.length}`);
    } else {
      console.log('✅ No obvious resource leaks detected');
    }

  } catch (error) {
    console.warn('⚠️  Could not check for resource leaks:', error);
  }
}

/**
 * Generate performance report
 */
function generatePerformanceReport(): void {
  console.log('📈 Generating performance report...');

  try {
    const report = {
      timestamp: new Date().toISOString(),
      setupDuration: parseInt(process.env.E2E_SETUP_DURATION || '0', 10),
      totalDuration: parseInt(process.env.E2E_TOTAL_DURATION || '0', 10),
      maxAllowedDuration: parseInt(process.env.E2E_MAX_TOTAL_DURATION || '60000', 10),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    // Calculate performance score (0-100)
    let performanceScore = 100;
    
    // Deduct points for slow execution
    if (report.totalDuration > report.maxAllowedDuration) {
      const overagePercent = ((report.totalDuration - report.maxAllowedDuration) / report.maxAllowedDuration) * 100;
      performanceScore -= Math.min(overagePercent, 50); // Max 50 point deduction
    }
    
    // Deduct points for slow setup
    if (report.setupDuration > 5000) {
      const setupOverage = (report.setupDuration - 5000) / 1000; // Seconds over 5s
      performanceScore -= Math.min(setupOverage * 5, 25); // Max 25 point deduction
    }

    report.performanceScore = Math.max(0, Math.round(performanceScore));

    console.log('📊 Performance Report:');
    console.log(`   Setup Duration: ${report.setupDuration}ms`);
    console.log(`   Total Duration: ${report.totalDuration}ms`);
    console.log(`   Memory Usage: ${(report.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Performance Score: ${report.performanceScore}/100`);

    // Provide recommendations
    if (report.performanceScore < 80) {
      console.log('💡 Performance Recommendations:');
      
      if (report.totalDuration > report.maxAllowedDuration) {
        console.log('   - Consider optimizing test execution or increasing timeout limits');
      }
      
      if (report.setupDuration > 5000) {
        console.log('   - Consider optimizing test setup (Redis connection, data cleanup)');
      }
      
      if (report.memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        console.log('   - Consider investigating memory usage patterns');
      }
    }

    // Store report for CI systems
    if (process.env.CI) {
      process.env.E2E_PERFORMANCE_REPORT = JSON.stringify(report);
    }

  } catch (error) {
    console.warn('⚠️  Could not generate performance report:', error);
  }
}

/**
 * Cleanup function for emergency situations
 */
async function emergencyCleanup(): Promise<void> {
  console.log('🚨 Performing emergency cleanup...');
  
  try {
    const redis = new Redis({
      host: TestConfigs.E2E_REDIS.host,
      port: TestConfigs.E2E_REDIS.port,
      db: TestConfigs.E2E_REDIS.db,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      keyPrefix: TestConfigs.E2E_REDIS.keyPrefix,
      connectTimeout: 2000,
      commandTimeout: 1000,
    });

    await TestUtils.cleanRedis(redis, `${TestConfigs.E2E_REDIS.keyPrefix}:*`);
    await redis.disconnect();
    
    console.log('✅ Emergency cleanup completed');
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, performing emergency cleanup...');
  await emergencyCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, performing emergency cleanup...');
  await emergencyCleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception during teardown:', error);
  await emergencyCleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💥 Unhandled rejection during teardown:', reason);
  await emergencyCleanup();
  process.exit(1);
});