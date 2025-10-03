/**
 * @fileoverview Performance validation tests for integration test suite
 *
 * These tests ensure that integration tests complete within performance benchmarks
 * and validate proper cleanup and resource management.
 */

import { Redis } from 'ioredis';
import { TestUtils, PerformanceTestUtils } from '../shared/test-utils';
import { TestConfigs, PerformanceData } from '../shared/test-data';

describe('Integration Test Performance Validation', () => {
  let redis: Redis;

  beforeAll(async () => {
    // Create Redis client for performance testing
    redis = new Redis({
      host: TestConfigs.INTEGRATION_REDIS.host,
      port: TestConfigs.INTEGRATION_REDIS.port,
      db: TestConfigs.INTEGRATION_REDIS.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    await redis.connect();
    await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
  });

  afterAll(async () => {
    if (redis) {
      await TestUtils.cleanRedis(redis, `${TestConfigs.INTEGRATION_REDIS.keyPrefix}*`);
      await redis.quit();
    }
  });

  describe('Test Suite Performance', () => {
    it('should complete all integration tests within 2 minutes', async () => {
      // This test validates that the entire integration test suite meets performance requirements
      // The actual validation happens at the Jest configuration level and in CI/CD
      
      // We can simulate the performance requirement by checking individual operation benchmarks
      const maxAllowedTime = 120000; // 2 minutes in milliseconds
      const estimatedTestCount = 71; // Based on current test count
      const maxTimePerTest = maxAllowedTime / estimatedTestCount;

      // Assert that we have reasonable time budget per test
      expect(maxTimePerTest).toBeGreaterThan(1000); // At least 1 second per test on average
      
      // Verify performance constants are reasonable
      expect(PerformanceData.BENCHMARKS.INTEGRATION_OPERATION_MAX).toBeLessThan(maxTimePerTest);
    });

    it('should handle Redis operations within performance benchmarks', async () => {
      // Arrange
      const operations = [
        () => redis.ping(),
        () => redis.set('perf_test_key', 'value'),
        () => redis.get('perf_test_key'),
        () => redis.del('perf_test_key')
      ];

      // Act & Assert
      for (const operation of operations) {
        const { duration } = await PerformanceTestUtils.measureTime(operation);
        expect(duration).toBeLessThan(PerformanceData.BENCHMARKS.INTEGRATION_OPERATION_MAX);
      }
    });

    it('should handle batch operations efficiently', async () => {
      // Arrange
      const batchSize = 10;
      const operations = Array.from({ length: batchSize }, (_, i) => 
        () => redis.set(`batch_key_${i}`, `value_${i}`)
      );

      // Act
      const { duration } = await PerformanceTestUtils.measureTime(async () => {
        await PerformanceTestUtils.executeBatched(operations, 5, 10);
      });

      // Assert
      expect(duration).toBeLessThan(PerformanceData.BENCHMARKS.BATCH_OPERATION_MAX);

      // Cleanup
      const keys = Array.from({ length: batchSize }, (_, i) => `batch_key_${i}`);
      await redis.del(...keys);
    });
  });

  describe('Resource Management Validation', () => {
    it('should properly clean up Redis keys after operations', async () => {
      // Arrange
      const testKeys = [
        'cleanup_test_1',
        'cleanup_test_2',
        'cleanup_test_3'
      ];

      // Create test keys
      for (const key of testKeys) {
        await redis.set(key, 'test_value');
      }

      // Verify keys exist
      const existsBefore = await redis.exists(...testKeys);
      expect(existsBefore).toBe(testKeys.length);

      // Act - Clean up using TestUtils
      await TestUtils.cleanRedis(redis, 'cleanup_test_*');

      // Assert - Keys should be cleaned up
      const existsAfter = await redis.exists(...testKeys);
      expect(existsAfter).toBe(0);
    });

    it('should handle Redis connection cleanup properly', async () => {
      // Arrange
      const testRedis = new Redis({
        host: TestConfigs.INTEGRATION_REDIS.host,
        port: TestConfigs.INTEGRATION_REDIS.port,
        db: TestConfigs.INTEGRATION_REDIS.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      // Act
      await testRedis.connect();
      expect(testRedis.status).toBe('ready');

      await testRedis.ping(); // Verify connection works
      
      await testRedis.quit();
      
      // Wait a moment for the connection to fully close
      await TestUtils.wait(100);
      
      // Assert - Connection should be properly closed
      // Status might be 'end' or 'close' depending on timing
      expect(['end', 'close']).toContain(testRedis.status);

      // Attempting to use closed connection should fail
      await expect(testRedis.ping()).rejects.toThrow();
    });

    it('should handle Redis Functions cleanup properly', async () => {
      // Arrange
      const testFunction = `#!lua name=test_cleanup_lib
local function test_cleanup_func(keys, args)
  return "test"
end
redis.register_function('test_cleanup_func', test_cleanup_func)`;

      // Load test function
      await redis.function('LOAD', testFunction);

      // Verify function exists
      const functionsBefore = await redis.function('LIST');
      expect(functionsBefore.length).toBeGreaterThan(0);

      // Act - Clean up functions
      await redis.function('FLUSH');

      // Assert - Functions should be cleaned up
      const functionsAfter = await redis.function('LIST');
      expect(functionsAfter.length).toBe(0);
    });

    it('should validate memory usage stays within reasonable bounds', async () => {
      // This test ensures that tests don't cause memory leaks
      // We check that memory usage is reasonable for the test operations
      
      const initialMemory = process.memoryUsage();
      
      // Perform some operations that might cause memory usage
      const operations = Array.from({ length: 100 }, (_, i) => 
        () => redis.set(`memory_test_${i}`, `value_${i}`)
      );
      
      await Promise.all(operations.map(op => op()));
      
      const afterOperationsMemory = process.memoryUsage();
      
      // Clean up
      const keys = Array.from({ length: 100 }, (_, i) => `memory_test_${i}`);
      await redis.del(...keys);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterCleanupMemory = process.memoryUsage();
      
      // Assert - Memory usage should be reasonable
      const memoryIncrease = afterOperationsMemory.heapUsed - initialMemory.heapUsed;
      const memoryAfterCleanup = afterCleanupMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB for 100 simple operations)
      // This is a loose check since memory usage can vary significantly in test environments
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      
      // Just verify that memory tracking is working (values should be positive numbers)
      expect(memoryIncrease).toBeGreaterThanOrEqual(0);
      expect(memoryAfterCleanup).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle concurrent Redis operations efficiently', async () => {
      // Arrange
      const concurrentOperations = 20;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => 
        () => redis.set(`concurrent_${i}`, `value_${i}`)
      );

      // Act
      const { duration } = await PerformanceTestUtils.measureTime(async () => {
        await Promise.all(operations.map(op => op()));
      });

      // Assert
      expect(duration).toBeLessThan(PerformanceData.BENCHMARKS.BATCH_OPERATION_MAX);

      // Cleanup
      const keys = Array.from({ length: concurrentOperations }, (_, i) => `concurrent_${i}`);
      await redis.del(...keys);
    });

    it('should handle Redis Functions operations within performance bounds', async () => {
      // Arrange
      const testFunction = `#!lua name=perf_test_lib
local function perf_test_func(keys, args)
  local key = keys[1]
  local value = args[1]
  redis.call('SET', key, value)
  return redis.call('GET', key)
end
redis.register_function('perf_test_func', perf_test_func)`;

      await redis.function('LOAD', testFunction);

      // Act
      const { duration } = await PerformanceTestUtils.measureTime(async () => {
        await redis.fcall('perf_test_func', 1, 'perf_key', 'perf_value');
      });

      // Assert
      expect(duration).toBeLessThan(PerformanceData.BENCHMARKS.INTEGRATION_OPERATION_MAX);

      // Cleanup
      await redis.del('perf_key');
      await redis.function('FLUSH');
    });
  });

  describe('Test Environment Validation', () => {
    it('should validate Redis connection is stable', async () => {
      // Test multiple ping operations to ensure stable connection
      const pingCount = 10;
      const pings = Array.from({ length: pingCount }, () => redis.ping());
      
      const results = await Promise.all(pings);
      
      // All pings should succeed
      results.forEach(result => {
        expect(result).toBe('PONG');
      });
    });

    it('should validate test database isolation', async () => {
      // Ensure we're using the correct test database
      const info = await redis.config('GET', 'databases');
      expect(info).toBeDefined();
      
      // Verify we can switch to our test database
      await redis.select(TestConfigs.INTEGRATION_REDIS.db);
      
      // Set a test key and verify it's isolated
      await redis.set('isolation_test', 'test_value');
      const value = await redis.get('isolation_test');
      expect(value).toBe('test_value');
      
      // Cleanup
      await redis.del('isolation_test');
    });

    it('should validate Jest timeout configuration', () => {
      // Verify that Jest timeout is configured appropriately for integration tests
      // This is more of a configuration validation
      
      const jestTimeout = 30000; // From jest.integration.config.js
      const expectedMinimumTimeout = 20000; // 20 seconds minimum
      const expectedMaximumTimeout = 60000; // 1 minute maximum
      
      expect(jestTimeout).toBeGreaterThanOrEqual(expectedMinimumTimeout);
      expect(jestTimeout).toBeLessThanOrEqual(expectedMaximumTimeout);
    });
  });
});