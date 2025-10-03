/**
 * @fileoverview Unit tests for configuration validation and creation
 *
 * Tests configuration validation, defaults, error scenarios, and enum usage
 * for FailureStrategy and error codes instead of magic strings.
 */

import { createConfig, getConfigSummary } from '../../src/config/config';
import { validateFailureStrategy, validatePort, validateRedisDb, validateMaxWindowSize, parseBoolean, validateConfig } from '../../src/config/validation';
import { RedisFailureStrategy, ThrottlerErrorCode } from '../../src/config/enums';
import { ThrottlerConfig } from '../../src/config/interfaces';
import { ThrottlerConfigurationError } from '../../src/core/errors';

describe('Configuration Unit Tests', () => {
  describe('createConfig', () => {
    it('should create valid configuration with required environment variables', () => {
      const env = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379'
      };

      const config = createConfig(env);

      expect(config).toEqual({
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0,
          password: '',
          keyPrefix: ''
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          keyPrefix: 'throttle',
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      });
    });

    it('should use default failure strategy when not specified', () => {
      const env = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379'
      };

      const config = createConfig(env);

      expect(config.throttler.failureStrategy).toBe(RedisFailureStrategy.FAIL_OPEN);
    });

    it('should parse all optional environment variables correctly', () => {
      const env = {
        REDIS_HOST: 'redis.example.com',
        REDIS_PORT: '6380',
        REDIS_DB: '2',
        REDIS_PASSWORD: 'secret123',
        REDIS_KEY_PREFIX: 'myapp',
        FAILURE_STRATEGY: RedisFailureStrategy.FAIL_CLOSED,
        THROTTLER_KEY_PREFIX: 'rate_limit',
        ENABLE_DEBUG_LOGGING: 'true',
        MAX_WINDOW_SIZE: '2000',
        ENABLE_REDIS_FUNCTIONS: 'false'
      };

      const config = createConfig(env);

      expect(config).toEqual({
        redis: {
          host: 'redis.example.com',
          port: 6380,
          db: 2,
          password: 'secret123',
          keyPrefix: 'myapp'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          keyPrefix: 'rate_limit',
          enableDebugLogging: true,
          maxWindowSize: 2000,
          enableRedisFunctions: false
        }
      });
    });

    it('should throw ThrottlerConfigurationError when REDIS_HOST is missing', () => {
      const env = {
        REDIS_PORT: '6379'
      };

      expect(() => createConfig(env)).toThrow(ThrottlerConfigurationError);
      expect(() => createConfig(env)).toThrow('REDIS_HOST is required');
    });

    it('should throw ThrottlerConfigurationError when REDIS_PORT is missing', () => {
      const env = {
        REDIS_HOST: 'localhost'
      };

      expect(() => createConfig(env)).toThrow(ThrottlerConfigurationError);
      expect(() => createConfig(env)).toThrow('REDIS_PORT is required');
    });

    it('should wrap validation errors in ThrottlerConfigurationError', () => {
      const env = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 'invalid_port'
      };

      expect(() => createConfig(env)).toThrow(ThrottlerConfigurationError);
      expect(() => createConfig(env)).toThrow('Configuration validation failed');
    });

    it('should enable debug logging in development environment', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const env = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379'
      };

      const config = createConfig(env);

      expect(config.throttler.enableDebugLogging).toBe(true);

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('validateFailureStrategy', () => {
    it('should accept valid RedisFailureStrategy enum values', () => {
      expect(validateFailureStrategy(RedisFailureStrategy.FAIL_OPEN)).toBe(RedisFailureStrategy.FAIL_OPEN);
      expect(validateFailureStrategy(RedisFailureStrategy.FAIL_CLOSED)).toBe(RedisFailureStrategy.FAIL_CLOSED);
    });

    it('should accept valid string values that match enum', () => {
      expect(validateFailureStrategy('fail-open')).toBe(RedisFailureStrategy.FAIL_OPEN);
      expect(validateFailureStrategy('fail-closed')).toBe(RedisFailureStrategy.FAIL_CLOSED);
    });

    it('should throw error for invalid failure strategy', () => {
      expect(() => validateFailureStrategy('invalid')).toThrow('Invalid failure strategy');
      expect(() => validateFailureStrategy('FAIL_OPEN')).toThrow('Invalid failure strategy');
      expect(() => validateFailureStrategy(123)).toThrow('Invalid failure strategy');
      expect(() => validateFailureStrategy(null)).toThrow('Invalid failure strategy');
    });

    it('should include valid strategies in error message', () => {
      try {
        validateFailureStrategy('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('fail-open');
        expect((error as Error).message).toContain('fail-closed');
      }
    });
  });

  describe('validatePort', () => {
    it('should accept valid port numbers as strings', () => {
      expect(validatePort('80')).toBe(80);
      expect(validatePort('443')).toBe(443);
      expect(validatePort('6379')).toBe(6379);
      expect(validatePort('65535')).toBe(65535);
    });

    it('should accept valid port numbers as numbers', () => {
      expect(validatePort(80)).toBe(80);
      expect(validatePort(443)).toBe(443);
      expect(validatePort(6379)).toBe(6379);
      expect(validatePort(65535)).toBe(65535);
    });

    it('should throw error for invalid port numbers', () => {
      expect(() => validatePort('0')).toThrow('Port must be a valid port number (1-65535)');
      expect(() => validatePort('65536')).toThrow('Port must be a valid port number (1-65535)');
      expect(() => validatePort('-1')).toThrow('Port must be a valid port number (1-65535)');
      expect(() => validatePort('abc')).toThrow('Port must be a valid port number (1-65535)');
      expect(() => validatePort(0)).toThrow('Port must be a valid port number (1-65535)');
      expect(() => validatePort(65536)).toThrow('Port must be a valid port number (1-65535)');
    });
  });

  describe('validateRedisDb', () => {
    it('should accept valid Redis database numbers as strings', () => {
      expect(validateRedisDb('0')).toBe(0);
      expect(validateRedisDb('1')).toBe(1);
      expect(validateRedisDb('15')).toBe(15);
    });

    it('should accept valid Redis database numbers as numbers', () => {
      expect(validateRedisDb(0)).toBe(0);
      expect(validateRedisDb(1)).toBe(1);
      expect(validateRedisDb(15)).toBe(15);
    });

    it('should throw error for invalid database numbers', () => {
      expect(() => validateRedisDb('-1')).toThrow('Redis database must be a number between 0 and 15');
      expect(() => validateRedisDb('16')).toThrow('Redis database must be a number between 0 and 15');
      expect(() => validateRedisDb('abc')).toThrow('Redis database must be a number between 0 and 15');
      expect(() => validateRedisDb(-1)).toThrow('Redis database must be a number between 0 and 15');
      expect(() => validateRedisDb(16)).toThrow('Redis database must be a number between 0 and 15');
    });
  });

  describe('validateMaxWindowSize', () => {
    it('should accept valid window sizes as strings', () => {
      expect(validateMaxWindowSize('100')).toBe(100);
      expect(validateMaxWindowSize('1000')).toBe(1000);
      expect(validateMaxWindowSize('10000')).toBe(10000);
    });

    it('should accept valid window sizes as numbers', () => {
      expect(validateMaxWindowSize(100)).toBe(100);
      expect(validateMaxWindowSize(1000)).toBe(1000);
      expect(validateMaxWindowSize(10000)).toBe(10000);
    });

    it('should throw error for invalid window sizes', () => {
      expect(() => validateMaxWindowSize('99')).toThrow('Maximum window size must be a number between 100 and 10000');
      expect(() => validateMaxWindowSize('10001')).toThrow('Maximum window size must be a number between 100 and 10000');
      expect(() => validateMaxWindowSize('abc')).toThrow('Maximum window size must be a number between 100 and 10000');
      expect(() => validateMaxWindowSize(99)).toThrow('Maximum window size must be a number between 100 and 10000');
      expect(() => validateMaxWindowSize(10001)).toThrow('Maximum window size must be a number between 100 and 10000');
    });
  });

  describe('parseBoolean', () => {
    it('should parse true values correctly', () => {
      expect(parseBoolean('true', false)).toBe(true);
      expect(parseBoolean('TRUE', false)).toBe(true);
      expect(parseBoolean('True', false)).toBe(true);
      expect(parseBoolean('1', false)).toBe(true);
      expect(parseBoolean('yes', false)).toBe(true);
      expect(parseBoolean('YES', false)).toBe(true);
    });

    it('should parse false values correctly', () => {
      expect(parseBoolean('false', true)).toBe(false);
      expect(parseBoolean('FALSE', true)).toBe(false);
      expect(parseBoolean('0', true)).toBe(false);
      expect(parseBoolean('no', true)).toBe(false);
      expect(parseBoolean('anything', true)).toBe(false);
    });

    it('should return default value for undefined input', () => {
      expect(parseBoolean(undefined, true)).toBe(true);
      expect(parseBoolean(undefined, false)).toBe(false);
    });

    it('should return default value for empty string', () => {
      expect(parseBoolean('', true)).toBe(true);
      expect(parseBoolean('', false)).toBe(false);
    });

    it('should handle whitespace correctly', () => {
      expect(parseBoolean('  true  ', false)).toBe(true);
      expect(parseBoolean('  false  ', true)).toBe(false);
    });
  });

  describe('validateConfig', () => {
    const createTestConfig = (overrides: Partial<ThrottlerConfig> = {}): ThrottlerConfig => ({
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'test'
      },
      throttler: {
        failureStrategy: RedisFailureStrategy.FAIL_OPEN,
        enableDebugLogging: false,
        maxWindowSize: 1000,
        enableRedisFunctions: true
      },
      ...overrides
    });

    it('should validate configuration without warnings for secure setup', () => {
      const config = createTestConfig({
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0,
          password: 'secure_password',
          keyPrefix: 'test'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      });

      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing password for remote Redis', () => {
      const config = createTestConfig({
        redis: {
          host: 'redis.example.com',
          port: 6379,
          db: 0,
          keyPrefix: 'test'
        }
      });

      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Redis password not set for remote connection - this may be insecure');
    });

    it('should warn about fail-open strategy', () => {
      const config = createTestConfig({
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      });

      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Using fail-open strategy - requests will be allowed when Redis is unavailable');
    });

    it('should warn about debug logging in production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const config = createTestConfig({
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: true,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      });

      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Debug logging is enabled in production - this may impact performance');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should warn about large window size', () => {
      const config = createTestConfig({
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          enableDebugLogging: false,
          maxWindowSize: 6000,
          enableRedisFunctions: true
        }
      });

      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large window size may impact memory usage and performance');
    });

    it('should not warn for localhost connections without password', () => {
      const config = createTestConfig({
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0,
          keyPrefix: 'test'
        }
      });

      const result = validateConfig(config);

      expect(result.warnings.some(w => w.includes('password'))).toBe(false);
    });

    it('should not warn for 127.0.0.1 connections without password', () => {
      const config = createTestConfig({
        redis: {
          host: '127.0.0.1',
          port: 6379,
          db: 0,
          keyPrefix: 'test'
        }
      });

      const result = validateConfig(config);

      expect(result.warnings.some(w => w.includes('password'))).toBe(false);
    });
  });

  describe('getConfigSummary', () => {
    it('should generate readable configuration summary', () => {
      const config: ThrottlerConfig = {
        redis: {
          host: 'localhost',
          port: 6379,
          db: 1,
          password: 'secret',
          keyPrefix: 'myapp'
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_CLOSED,
          keyPrefix: 'rate_limit',
          enableDebugLogging: true,
          maxWindowSize: 2000,
          enableRedisFunctions: false
        }
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('=== Throttler Configuration ===');
      expect(summary).toContain('Redis: localhost:6379 (db: 1)');
      expect(summary).toContain('Key Prefix: myapp');
      expect(summary).toContain('Failure Strategy: fail-closed');
      expect(summary).toContain('Max Window Size: 2000');
      expect(summary).toContain('Debug Logging: enabled');
      expect(summary).toContain('Redis Functions: disabled');
      expect(summary).toContain('==============================');
    });

    it('should handle undefined optional values correctly', () => {
      const config: ThrottlerConfig = {
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0
        },
        throttler: {
          failureStrategy: RedisFailureStrategy.FAIL_OPEN,
          enableDebugLogging: false,
          maxWindowSize: 1000,
          enableRedisFunctions: true
        }
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('Redis: localhost:6379 (db: 0)');
      expect(summary).toContain('Key Prefix: throttle');
      expect(summary).toContain('Debug Logging: disabled');
      expect(summary).toContain('Redis Functions: enabled');
    });
  });

  describe('Error Code Usage', () => {
    it('should use ThrottlerErrorCode enum instead of magic strings', () => {
      // Verify that error codes are properly typed enums
      expect(ThrottlerErrorCode.INVALID_CONFIGURATION).toBe('INVALID_CONFIGURATION');
      expect(ThrottlerErrorCode.MISSING_REQUIRED_CONFIG).toBe('MISSING_REQUIRED_CONFIG');
      expect(ThrottlerErrorCode.REDIS_CONNECTION_FAILED).toBe('REDIS_CONNECTION_FAILED');
      expect(ThrottlerErrorCode.REDIS_OPERATION_FAILED).toBe('REDIS_OPERATION_FAILED');
      expect(ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED).toBe('REDIS_FUNCTIONS_LOAD_FAILED');
      expect(ThrottlerErrorCode.STORAGE_OPERATION_FAILED).toBe('STORAGE_OPERATION_FAILED');
      expect(ThrottlerErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should throw ThrottlerConfigurationError with proper error code', () => {
      const env = {
        REDIS_HOST: 'localhost'
        // Missing REDIS_PORT
      };

      try {
        createConfig(env);
        fail('Expected ThrottlerConfigurationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ThrottlerConfigurationError);
        expect((error as ThrottlerConfigurationError).code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
      }
    });
  });

  describe('Enum Usage Validation', () => {
    it('should only accept RedisFailureStrategy enum values', () => {
      // Test that we cannot use magic strings
      const env = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        FAILURE_STRATEGY: 'some-random-string'
      };

      expect(() => createConfig(env)).toThrow();
    });

    it('should properly validate enum values at runtime', () => {
      // Ensure enum validation works correctly
      expect(() => validateFailureStrategy('not-an-enum-value')).toThrow();
      expect(validateFailureStrategy(RedisFailureStrategy.FAIL_OPEN)).toBe(RedisFailureStrategy.FAIL_OPEN);
      expect(validateFailureStrategy(RedisFailureStrategy.FAIL_CLOSED)).toBe(RedisFailureStrategy.FAIL_CLOSED);
    });
  });
});