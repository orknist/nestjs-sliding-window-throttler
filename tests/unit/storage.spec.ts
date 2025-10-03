/**
 * @fileoverview Unit tests for SlidingWindowThrottlerStorage
 *
 * Tests storage logic with fully mocked Redis client, focusing on business logic
 * validation without real Redis connections. All tests should execute in under 100ms each.
 */

import { SlidingWindowThrottlerStorage } from '../../src/storage/sliding-window-throttler.storage';
import { MockFactories, MockRedis, MockRedisFunctionsManager, MockLogger } from '../shared/mock-factories';
import { TestConfigs, TestConstants } from '../shared/test-data';
import { KeyGenerator } from '../../src/core/key-generator';
import { ThrottlerConfig } from '../../src/config/interfaces';
import { RedisFailureStrategy, ThrottlerErrorCode } from '../../src/config/enums';
import { ThrottlerError, ThrottlerRedisConnectionError, ThrottlerConfigurationError } from '../../src/core/errors';
import { RedisFunctionResult } from '../../src/redis/types';

describe('SlidingWindowThrottlerStorage Unit Tests', () => {
  let mockRedis: MockRedis;
  let mockFunctionsManager: MockRedisFunctionsManager;
  let mockLogger: MockLogger;
  let keyGenerator: KeyGenerator;
  let config: ThrottlerConfig;
  let storage: SlidingWindowThrottlerStorage;

  beforeEach(() => {
    mockRedis = MockFactories.createMockRedis();
    mockFunctionsManager = MockFactories.createMockRedisFunctionsManager();
    mockLogger = MockFactories.createMockLogger();
    keyGenerator = MockFactories.createKeyGenerator();
    config = TestConfigs.FAIL_OPEN_CONFIG;

    storage = new SlidingWindowThrottlerStorage(
      mockRedis,
      config,
      mockFunctionsManager,
      keyGenerator,
      mockLogger
    );
  });

  describe('Constructor and Initialization', () => {
    it('should initialize storage with all dependencies', () => {
      expect(storage).toBeInstanceOf(SlidingWindowThrottlerStorage);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SlidingWindowThrottlerStorage initialized',
        expect.objectContaining({
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        })
      );
    });

    it('should work without logger', () => {
      const storageWithoutLogger = new SlidingWindowThrottlerStorage(
        mockRedis,
        config,
        mockFunctionsManager,
        keyGenerator
      );

      expect(storageWithoutLogger).toBeInstanceOf(SlidingWindowThrottlerStorage);
    });
  });

  describe('Parameter Validation', () => {
    it('should throw ThrottlerConfigurationError for empty key', async () => {
      await expect(
        storage.increment('', 60000, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('', 60000, 5, 30000, 'api')
      ).rejects.toThrow('Invalid key: must be a non-empty string');
    });

    it('should throw ThrottlerConfigurationError for non-string key', async () => {
      await expect(
        storage.increment(null as unknown as string, 60000, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should throw ThrottlerConfigurationError for invalid TTL', async () => {
      await expect(
        storage.increment('user123', 0, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', -1000, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', 1.5, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should throw ThrottlerConfigurationError for invalid limit', async () => {
      await expect(
        storage.increment('user123', 60000, 0, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', 60000, -5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', 60000, 2.5, 30000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should throw ThrottlerConfigurationError for invalid block duration', async () => {
      await expect(
        storage.increment('user123', 60000, 5, -1000, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', 60000, 5, 1.5, 'api')
      ).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should throw ThrottlerConfigurationError for empty throttler name', async () => {
      await expect(
        storage.increment('user123', 60000, 5, 30000, '')
      ).rejects.toThrow(ThrottlerConfigurationError);

      await expect(
        storage.increment('user123', 60000, 5, 30000, null as unknown as string)
      ).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should accept valid parameters', async () => {
      const result: RedisFunctionResult = [1, 60, 0, -1];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      await expect(
        storage.increment('user123', 60000, 5, 30000, 'api')
      ).resolves.toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });

    it('should accept zero block duration', async () => {
      const result: RedisFunctionResult = [1, 60, 0, -1];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      await expect(
        storage.increment('user123', 60000, 5, 0, 'api')
      ).resolves.toBeDefined();
    });
  });

  describe('Redis Functions Integration', () => {
    it('should use Redis Functions when available and enabled', async () => {
      const result: RedisFunctionResult = [3, 57, 0, -1];
      mockFunctionsManager.isLoaded.mockReturnValue(true);
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockFunctionsManager.executeSlidingWindow).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('user123'),
          expect.stringContaining('user123')
        ]),
        expect.arrayContaining([
          '60000',
          '5',
          '30000',
          expect.stringMatching(/^\d+$/),
          expect.stringMatching(/^\d+:[a-z0-9]{6}$/)
        ])
      );

      expect(throttlerResult).toEqual({
        totalHits: 3,
        timeToExpire: 57,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });

    it('should fall back to Lua script when Redis Functions not loaded', async () => {
      mockFunctionsManager.isLoaded.mockReturnValue(false);
      mockRedis.eval.mockResolvedValue([2, 58, 0, -1]);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockFunctionsManager.executeSlidingWindow).not.toHaveBeenCalled();
      expect(mockRedis.eval).toHaveBeenCalled();

      expect(throttlerResult).toEqual({
        totalHits: 2,
        timeToExpire: 58,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });

    it('should fall back to Lua script when Redis Functions disabled', async () => {
      const configWithoutFunctions = {
        ...config,
        throttler: {
          ...config.throttler,
          enableRedisFunctions: false
        }
      };

      const storageWithoutFunctions = new SlidingWindowThrottlerStorage(
        mockRedis,
        configWithoutFunctions,
        mockFunctionsManager,
        keyGenerator,
        mockLogger
      );

      mockRedis.eval.mockResolvedValue([1, 60, 0, -1]);

      await storageWithoutFunctions.increment('user123', 60000, 5, 30000, 'api');

      expect(mockFunctionsManager.executeSlidingWindow).not.toHaveBeenCalled();
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should retry Redis Function after reload on failure', async () => {
      const functionError = new ThrottlerError('Function failed', ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED);
      const retryResult: RedisFunctionResult = [1, 60, 0, -1];

      mockFunctionsManager.isLoaded.mockReturnValue(true);
      mockFunctionsManager.executeSlidingWindow
        .mockRejectedValueOnce(functionError)
        .mockResolvedValueOnce(retryResult);
      mockFunctionsManager.reloadLibrary.mockResolvedValue();

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockFunctionsManager.reloadLibrary).toHaveBeenCalled();
      expect(mockFunctionsManager.executeSlidingWindow).toHaveBeenCalledTimes(2);
      expect(throttlerResult).toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });

    it('should fall back to Lua script when retry fails', async () => {
      const functionError = new ThrottlerError('Function failed', ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED);

      mockFunctionsManager.isLoaded.mockReturnValue(true);
      mockFunctionsManager.executeSlidingWindow.mockRejectedValue(functionError);
      mockFunctionsManager.reloadLibrary.mockRejectedValue(new Error('Reload failed'));
      mockRedis.eval.mockResolvedValue([1, 60, 0, -1]);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockFunctionsManager.reloadLibrary).toHaveBeenCalled();
      expect(mockRedis.eval).toHaveBeenCalled();
      expect(throttlerResult).toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });
  });

  describe('Lua Script Execution', () => {
    beforeEach(() => {
      mockFunctionsManager.isLoaded.mockReturnValue(false);
    });

    it('should execute Lua script with correct parameters', async () => {
      mockRedis.eval.mockResolvedValue([2, 58, 0, -1]);

      await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local zKey = KEYS[1]'),
        2, // Number of keys
        expect.stringContaining('user123'), // zKey
        expect.stringContaining('user123'), // blockKey
        '60000', // ttl
        '5', // limit
        '30000', // blockDuration
        expect.stringMatching(/^\d+$/), // timestamp
        expect.stringMatching(/^\d+:[a-z0-9]{6}$/) // member
      );
    });

    it('should handle blocked response from Lua script', async () => {
      mockRedis.eval.mockResolvedValue([6, 45, 1, 25]);

      const result = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(result).toEqual({
        totalHits: 6,
        timeToExpire: 45,
        isBlocked: true,
        timeToBlockExpire: 25
      });
    });

    it('should handle allowed response from Lua script', async () => {
      mockRedis.eval.mockResolvedValue([3, 57, 0, -1]);

      const result = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(result).toEqual({
        totalHits: 3,
        timeToExpire: 57,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });

    it('should include maxWindowSize in Lua script', async () => {
      mockRedis.eval.mockResolvedValue([1, 60, 0, -1]);

      await storage.increment('user123', 60000, 5, 30000, 'api');

      const luaScript = mockRedis.eval.mock.calls[0]?.[0] as string;
      expect(luaScript).toContain('local maxWindowSize = 1000');
    });
  });

  describe('Result Parsing', () => {
    it('should parse Redis Function result correctly', async () => {
      const result: RedisFunctionResult = [5, 42, 1, 18];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(throttlerResult).toEqual({
        totalHits: 5,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 18
      });
    });

    it('should ensure non-negative totalHits', async () => {
      const result: RedisFunctionResult = [-1, 60, 1, 30];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(throttlerResult.totalHits).toBe(0); // Should be clamped to 0
    });

    it('should ensure non-negative timeToExpire', async () => {
      const result: RedisFunctionResult = [1, -5, 0, -1];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(result);

      const throttlerResult = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(throttlerResult.timeToExpire).toBe(0); // Should be clamped to 0
    });

    it('should parse isBlocked correctly', async () => {
      const blockedResult: RedisFunctionResult = [6, 60, 1, 30];
      const allowedResult: RedisFunctionResult = [3, 60, 0, -1];

      mockFunctionsManager.executeSlidingWindow
        .mockResolvedValueOnce(blockedResult)
        .mockResolvedValueOnce(allowedResult);

      const blockedResponse = await storage.increment('user1', 60000, 5, 30000, 'api');
      const allowedResponse = await storage.increment('user2', 60000, 5, 30000, 'api');

      expect(blockedResponse.isBlocked).toBe(true);
      expect(allowedResponse.isBlocked).toBe(false);
    });

    it('should handle timeToBlockExpire correctly', async () => {
      const withBlockResult: RedisFunctionResult = [6, 60, 1, 25];
      const withoutBlockResult: RedisFunctionResult = [3, 60, 0, -1];

      mockFunctionsManager.executeSlidingWindow
        .mockResolvedValueOnce(withBlockResult)
        .mockResolvedValueOnce(withoutBlockResult);

      const blockedResponse = await storage.increment('user1', 60000, 5, 30000, 'api');
      const allowedResponse = await storage.increment('user2', 60000, 5, 30000, 'api');

      expect(blockedResponse.timeToBlockExpire).toBe(25);
      expect(allowedResponse.timeToBlockExpire).toBe(-1);
    });
  });

  describe('Failure Strategy Handling', () => {
    it('should apply fail-open strategy on Redis connection error', async () => {
      const connectionError = new Error('Redis connection failed');
      mockFunctionsManager.executeSlidingWindow.mockRejectedValue(connectionError);
      mockRedis.eval.mockRejectedValue(connectionError);

      const result = await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(result).toEqual({
        isBlocked: false,
        totalHits: 1,
        timeToExpire: 60000,
        timeToBlockExpire: 0
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('fail-open strategy'),
        expect.objectContaining({
          key: expect.stringContaining('*'),
          throttlerName: 'api'
        })
      );
    });

    it('should apply fail-closed strategy on Redis connection error', async () => {
      const failClosedConfig = {
        ...config,
        throttler: {
          ...config.throttler,
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED
        }
      };

      const failClosedStorage = new SlidingWindowThrottlerStorage(
        mockRedis,
        failClosedConfig,
        mockFunctionsManager,
        keyGenerator,
        mockLogger
      );

      const connectionError = new Error('Connection timeout');
      mockFunctionsManager.executeSlidingWindow.mockRejectedValue(connectionError);
      mockRedis.eval.mockRejectedValue(connectionError);

      const result = await failClosedStorage.increment('user123', 60000, 5, 30000, 'api');

      expect(result).toEqual({
        isBlocked: true,
        totalHits: 999999,
        timeToExpire: 60000,
        timeToBlockExpire: 30000
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('fail-closed strategy'),
        expect.objectContaining({
          key: expect.stringContaining('*'),
          throttlerName: 'api'
        })
      );
    });

    it('should detect Redis connection errors correctly', async () => {
      const connectionErrors = [
        new Error('connect ECONNREFUSED 127.0.0.1:6379'),
        new Error('Connection timeout'),
        new Error('Redis connection failed'),
        new Error('Network error occurred')
      ];

      for (const error of connectionErrors) {
        mockFunctionsManager.executeSlidingWindow.mockRejectedValueOnce(error);
        mockRedis.eval.mockRejectedValueOnce(error);

        const result = await storage.increment(`user${Date.now()}`, 60000, 5, 30000, 'api');

        expect(result.isBlocked).toBe(false); // Fail-open strategy
      }
    });

    it('should re-throw non-connection errors when both Redis Function and Lua script fail', async () => {
      const storageError = new ThrottlerError('Storage operation failed', ThrottlerErrorCode.STORAGE_OPERATION_FAILED);
      mockFunctionsManager.isLoaded.mockReturnValue(true);
      mockFunctionsManager.executeSlidingWindow.mockRejectedValue(storageError);
      mockRedis.eval.mockRejectedValue(storageError);

      await expect(
        storage.increment('user123', 60000, 5, 30000, 'api')
      ).rejects.toThrow(ThrottlerError);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset rate limit data for a key', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['throttle:user123:api:z']])
        .mockResolvedValueOnce(['0', ['throttle:user123:api:block']]);
      mockRedis.del.mockResolvedValue(2);

      await storage.reset('user123');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2); // Once for z keys, once for block keys
      expect(mockRedis.del).toHaveBeenCalledWith('throttle:user123:api:z', 'throttle:user123:api:block');
    });

    it('should handle reset when no keys exist', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await storage.reset('user123');

      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Reset completed - no keys found',
        expect.objectContaining({
          key: expect.stringContaining('*')
        })
      );
    });

    it('should throw ThrottlerConfigurationError for invalid key in reset', async () => {
      await expect(storage.reset('')).rejects.toThrow(ThrottlerConfigurationError);
      await expect(storage.reset(null as unknown as string)).rejects.toThrow(ThrottlerConfigurationError);
    });

    it('should ignore Redis failures during reset', async () => {
      const redisError = new Error('Redis connection failed');
      mockRedis.scan.mockRejectedValue(redisError);

      // Should not throw, just log and continue
      await expect(storage.reset('user123')).resolves.toBeUndefined();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Reset operation ignored due to Redis failure',
        expect.objectContaining({
          key: expect.stringContaining('*'),
          failureStrategy: RedisFailureStrategy.FAIL_OPEN
        })
      );
    });

    it('should re-throw non-Redis errors during reset', async () => {
      const configError = new ThrottlerConfigurationError('Invalid reset config');
      mockRedis.scan.mockRejectedValue(configError);

      await expect(storage.reset('user123')).rejects.toThrow(ThrottlerConfigurationError);
    });
  });

  describe('Logging and Debugging', () => {
    it('should log increment operation start', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Increment operation started',
        expect.objectContaining({
          key: expect.stringContaining('*'),
          ttl: 60000,
          limit: 5,
          blockDuration: 30000,
          throttlerName: 'api'
        })
      );
    });

    it('should log rate limit exceeded warning', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([6, 45, 1, 25]);

      await storage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limit exceeded',
        expect.objectContaining({
          throttlerName: 'api',
          key: expect.stringContaining('*'),
          limit: 5,
          current: 6
        })
      );
    });

    it('should mask sensitive key information in logs', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      await storage.increment('sensitive_user_id_12345', 60000, 5, 30000, 'api');

      // Check that the key is masked in log calls
      const debugCalls = mockLogger.debug.mock.calls;
      const loggedKey = debugCalls[0]?.[1]?.key as string;

      expect(loggedKey).toContain('*');
      expect(loggedKey).not.toBe('sensitive_user_id_12345');
    });

    it('should log debug timing information when debug logging enabled', async () => {
      const debugConfig = {
        ...config,
        throttler: {
          ...config.throttler,
          enableDebugLogging: true
        }
      };

      const debugStorage = new SlidingWindowThrottlerStorage(
        mockRedis,
        debugConfig,
        mockFunctionsManager,
        keyGenerator,
        mockLogger
      );

      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      await debugStorage.increment('user123', 60000, 5, 30000, 'api');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Increment operation completed',
        expect.objectContaining({
          duration: expect.stringMatching(/^\d+ms$/),
          blocked: false
        })
      );
    });

    it('should not log debug timing when debug logging disabled', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      await storage.increment('user123', 60000, 5, 30000, 'api');

      const debugCalls = mockLogger.debug.mock.calls;
      const timingCall = debugCalls.find(call =>
        call[0] === 'Increment operation completed'
      );

      expect(timingCall).toBeUndefined();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large numbers correctly', async () => {
      const largeResult: RedisFunctionResult = [999999, 86400, 1, 3600];
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue(largeResult);

      const result = await storage.increment('user123', 86400000, 1000000, 3600000, 'api');

      expect(result).toEqual({
        totalHits: 999999,
        timeToExpire: 86400,
        isBlocked: true,
        timeToBlockExpire: 3600
      });
    });

    it('should handle concurrent increment calls', async () => {
      const results: RedisFunctionResult[] = [
        [1, 60, 0, -1],
        [2, 59, 0, -1],
        [3, 58, 0, -1]
      ];

      mockFunctionsManager.executeSlidingWindow
        .mockResolvedValueOnce(results[0])
        .mockResolvedValueOnce(results[1])
        .mockResolvedValueOnce(results[2]);

      const promises = [
        storage.increment('user1', 60000, 5, 30000, 'api'),
        storage.increment('user2', 60000, 5, 30000, 'api'),
        storage.increment('user3', 60000, 5, 30000, 'api')
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      expect(responses[0].totalHits).toBe(1);
      expect(responses[1].totalHits).toBe(2);
      expect(responses[2].totalHits).toBe(3);
    });

    it('should execute within performance requirements', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      const startTime = Date.now();
      await storage.increment('user123', 60000, 5, 30000, 'api');
      const duration = Date.now() - startTime;

      // Should complete in under 100ms (unit test requirement)
      expect(duration).toBeLessThan(100);
    });

    it('should handle special characters in keys and throttler names', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 60, 0, -1]);

      await expect(
        storage.increment('user@example.com', 60000, 5, 30000, 'api/v1')
      ).resolves.toBeDefined();

      expect(mockFunctionsManager.executeSlidingWindow).toHaveBeenCalled();
    });

    it('should handle minimum valid values', async () => {
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([1, 1, 0, -1]);

      const result = await storage.increment('u', 1, 1, 0, 'a');

      expect(result).toEqual({
        totalHits: 1,
        timeToExpire: 1,
        isBlocked: false,
        timeToBlockExpire: -1
      });
    });
  });
});