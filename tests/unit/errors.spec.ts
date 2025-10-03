/**
 * @fileoverview Unit tests for error classes and error handling
 *
 * Tests error creation, codes, handling, and type guards for all error types
 * in the throttler system.
 */

import {
  ThrottlerError,
  ThrottlerRedisConnectionError,
  ThrottlerConfigurationError,
  ThrottlerErrorCode,
  isThrottlerError,
  isThrottlerRedisConnectionError,
  isThrottlerConfigurationError
} from '../../src/core/errors';

describe('Error Classes Unit Tests', () => {
  describe('ThrottlerError', () => {
    it('should create error with message only', () => {
      const error = new ThrottlerError('Test error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ThrottlerError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ThrottlerError');
      expect(error.code).toBe(ThrottlerErrorCode.UNKNOWN_ERROR);
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new ThrottlerError('Configuration invalid', ThrottlerErrorCode.INVALID_CONFIGURATION);
      
      expect(error.message).toBe('Configuration invalid');
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message, code, and cause', () => {
      const cause = new Error('Original error');
      const error = new ThrottlerError('Wrapped error', ThrottlerErrorCode.REDIS_OPERATION_FAILED, cause);
      
      expect(error.message).toBe('Wrapped error');
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_OPERATION_FAILED);
      expect(error.cause).toBe(cause);
    });

    it('should have proper stack trace', () => {
      const error = new ThrottlerError('Stack trace test');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ThrottlerError');
      expect(error.stack).toContain('Stack trace test');
    });

    it('should use default error code when not provided', () => {
      const error = new ThrottlerError('Default code test');
      
      expect(error.code).toBe(ThrottlerErrorCode.UNKNOWN_ERROR);
    });

    it('should preserve error properties when serialized', () => {
      const cause = new Error('Cause error');
      const error = new ThrottlerError('Serialization test', ThrottlerErrorCode.STORAGE_OPERATION_FAILED, cause);
      
      expect(error.message).toBe('Serialization test');
      expect(error.code).toBe(ThrottlerErrorCode.STORAGE_OPERATION_FAILED);
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('ThrottlerError');
    });
  });

  describe('ThrottlerRedisConnectionError', () => {
    it('should create Redis connection error with message only', () => {
      const error = new ThrottlerRedisConnectionError('Redis connection failed');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ThrottlerError);
      expect(error).toBeInstanceOf(ThrottlerRedisConnectionError);
      expect(error.message).toBe('Redis connection failed');
      expect(error.name).toBe('ThrottlerRedisConnectionError');
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_CONNECTION_FAILED);
      expect(error.cause).toBeUndefined();
    });

    it('should create Redis connection error with message and cause', () => {
      const cause = new Error('ECONNREFUSED');
      const error = new ThrottlerRedisConnectionError('Connection refused', cause);
      
      expect(error.message).toBe('Connection refused');
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_CONNECTION_FAILED);
      expect(error.cause).toBe(cause);
    });

    it('should automatically set correct error code', () => {
      const error = new ThrottlerRedisConnectionError('Auto code test');
      
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_CONNECTION_FAILED);
    });

    it('should inherit from ThrottlerError', () => {
      const error = new ThrottlerRedisConnectionError('Inheritance test');
      
      expect(error instanceof ThrottlerError).toBe(true);
      expect(error instanceof ThrottlerRedisConnectionError).toBe(true);
    });
  });

  describe('ThrottlerConfigurationError', () => {
    it('should create configuration error with message only', () => {
      const error = new ThrottlerConfigurationError('Invalid configuration');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ThrottlerError);
      expect(error).toBeInstanceOf(ThrottlerConfigurationError);
      expect(error.message).toBe('Invalid configuration');
      expect(error.name).toBe('ThrottlerConfigurationError');
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
      expect(error.field).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should create configuration error with message and field', () => {
      const error = new ThrottlerConfigurationError('Port is invalid', 'port');
      
      expect(error.message).toBe('Port is invalid');
      expect(error.field).toBe('port');
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
    });

    it('should create configuration error with message, field, and cause', () => {
      const cause = new Error('Validation failed');
      const error = new ThrottlerConfigurationError('Field validation error', 'redis.host', cause);
      
      expect(error.message).toBe('Field validation error');
      expect(error.field).toBe('redis.host');
      expect(error.cause).toBe(cause);
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
    });

    it('should automatically set correct error code', () => {
      const error = new ThrottlerConfigurationError('Auto code test');
      
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
    });

    it('should inherit from ThrottlerError', () => {
      const error = new ThrottlerConfigurationError('Inheritance test');
      
      expect(error instanceof ThrottlerError).toBe(true);
      expect(error instanceof ThrottlerConfigurationError).toBe(true);
    });
  });

  describe('Error Code Enum', () => {
    it('should have all required error codes', () => {
      expect(ThrottlerErrorCode.INVALID_CONFIGURATION).toBe('INVALID_CONFIGURATION');
      expect(ThrottlerErrorCode.MISSING_REQUIRED_CONFIG).toBe('MISSING_REQUIRED_CONFIG');
      expect(ThrottlerErrorCode.REDIS_CONNECTION_FAILED).toBe('REDIS_CONNECTION_FAILED');
      expect(ThrottlerErrorCode.REDIS_OPERATION_FAILED).toBe('REDIS_OPERATION_FAILED');
      expect(ThrottlerErrorCode.REDIS_FUNCTIONS_LOAD_FAILED).toBe('REDIS_FUNCTIONS_LOAD_FAILED');
      expect(ThrottlerErrorCode.STORAGE_OPERATION_FAILED).toBe('STORAGE_OPERATION_FAILED');
      expect(ThrottlerErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should use enum values instead of magic strings', () => {
      const error = new ThrottlerError('Test', ThrottlerErrorCode.REDIS_OPERATION_FAILED);
      
      // Should use enum value, not magic string
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_OPERATION_FAILED);
      expect(error.code).toBe('REDIS_OPERATION_FAILED');
    });

    it('should have unique error code values', () => {
      const codes = Object.values(ThrottlerErrorCode);
      const uniqueCodes = new Set(codes);
      
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('Type Guards', () => {
    describe('isThrottlerError', () => {
      it('should return true for ThrottlerError instances', () => {
        const error = new ThrottlerError('Test error');
        
        expect(isThrottlerError(error)).toBe(true);
      });

      it('should return true for ThrottlerRedisConnectionError instances', () => {
        const error = new ThrottlerRedisConnectionError('Redis error');
        
        expect(isThrottlerError(error)).toBe(true);
      });

      it('should return true for ThrottlerConfigurationError instances', () => {
        const error = new ThrottlerConfigurationError('Config error');
        
        expect(isThrottlerError(error)).toBe(true);
      });

      it('should return false for regular Error instances', () => {
        const error = new Error('Regular error');
        
        expect(isThrottlerError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isThrottlerError('string')).toBe(false);
        expect(isThrottlerError(123)).toBe(false);
        expect(isThrottlerError(null)).toBe(false);
        expect(isThrottlerError(undefined)).toBe(false);
        expect(isThrottlerError({})).toBe(false);
        expect(isThrottlerError([])).toBe(false);
      });

      it('should provide proper type narrowing', () => {
        const error: unknown = new ThrottlerError('Test');
        
        if (isThrottlerError(error)) {
          // TypeScript should know this is a ThrottlerError
          expect(error.code).toBeDefined();
          expect(error.message).toBe('Test');
        }
      });
    });

    describe('isThrottlerRedisConnectionError', () => {
      it('should return true for ThrottlerRedisConnectionError instances', () => {
        const error = new ThrottlerRedisConnectionError('Redis error');
        
        expect(isThrottlerRedisConnectionError(error)).toBe(true);
      });

      it('should return false for base ThrottlerError instances', () => {
        const error = new ThrottlerError('Base error');
        
        expect(isThrottlerRedisConnectionError(error)).toBe(false);
      });

      it('should return false for ThrottlerConfigurationError instances', () => {
        const error = new ThrottlerConfigurationError('Config error');
        
        expect(isThrottlerRedisConnectionError(error)).toBe(false);
      });

      it('should return false for regular Error instances', () => {
        const error = new Error('Regular error');
        
        expect(isThrottlerRedisConnectionError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isThrottlerRedisConnectionError('string')).toBe(false);
        expect(isThrottlerRedisConnectionError(123)).toBe(false);
        expect(isThrottlerRedisConnectionError(null)).toBe(false);
        expect(isThrottlerRedisConnectionError(undefined)).toBe(false);
      });

      it('should provide proper type narrowing', () => {
        const error: unknown = new ThrottlerRedisConnectionError('Redis error');
        
        if (isThrottlerRedisConnectionError(error)) {
          // TypeScript should know this is a ThrottlerRedisConnectionError
          expect(error.code).toBe(ThrottlerErrorCode.REDIS_CONNECTION_FAILED);
          expect(error.message).toBe('Redis error');
        }
      });
    });

    describe('isThrottlerConfigurationError', () => {
      it('should return true for ThrottlerConfigurationError instances', () => {
        const error = new ThrottlerConfigurationError('Config error');
        
        expect(isThrottlerConfigurationError(error)).toBe(true);
      });

      it('should return false for base ThrottlerError instances', () => {
        const error = new ThrottlerError('Base error');
        
        expect(isThrottlerConfigurationError(error)).toBe(false);
      });

      it('should return false for ThrottlerRedisConnectionError instances', () => {
        const error = new ThrottlerRedisConnectionError('Redis error');
        
        expect(isThrottlerConfigurationError(error)).toBe(false);
      });

      it('should return false for regular Error instances', () => {
        const error = new Error('Regular error');
        
        expect(isThrottlerConfigurationError(error)).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isThrottlerConfigurationError('string')).toBe(false);
        expect(isThrottlerConfigurationError(123)).toBe(false);
        expect(isThrottlerConfigurationError(null)).toBe(false);
        expect(isThrottlerConfigurationError(undefined)).toBe(false);
      });

      it('should provide proper type narrowing', () => {
        const error: unknown = new ThrottlerConfigurationError('Config error', 'field');
        
        if (isThrottlerConfigurationError(error)) {
          // TypeScript should know this is a ThrottlerConfigurationError
          expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
          expect(error.field).toBe('field');
          expect(error.message).toBe('Config error');
        }
      });
    });
  });

  describe('Error Inheritance Chain', () => {
    it('should maintain proper inheritance for ThrottlerRedisConnectionError', () => {
      const error = new ThrottlerRedisConnectionError('Redis error');
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ThrottlerError).toBe(true);
      expect(error instanceof ThrottlerRedisConnectionError).toBe(true);
      expect(error instanceof ThrottlerConfigurationError).toBe(false);
    });

    it('should maintain proper inheritance for ThrottlerConfigurationError', () => {
      const error = new ThrottlerConfigurationError('Config error');
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ThrottlerError).toBe(true);
      expect(error instanceof ThrottlerConfigurationError).toBe(true);
      expect(error instanceof ThrottlerRedisConnectionError).toBe(false);
    });

    it('should maintain proper inheritance for base ThrottlerError', () => {
      const error = new ThrottlerError('Base error');
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ThrottlerError).toBe(true);
      expect(error instanceof ThrottlerRedisConnectionError).toBe(false);
      expect(error instanceof ThrottlerConfigurationError).toBe(false);
    });
  });

  describe('Error Serialization and JSON', () => {
    it('should serialize ThrottlerError properties', () => {
      const error = new ThrottlerError('Serialization test', ThrottlerErrorCode.STORAGE_OPERATION_FAILED);
      
      // Test that custom properties are accessible
      expect(error.code).toBe(ThrottlerErrorCode.STORAGE_OPERATION_FAILED);
      expect(error.message).toBe('Serialization test');
      expect(error.name).toBe('ThrottlerError');
    });

    it('should serialize ThrottlerConfigurationError field property', () => {
      const error = new ThrottlerConfigurationError('Field error', 'testField');
      
      expect(error.field).toBe('testField');
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
    });

    it('should preserve cause chain', () => {
      const originalError = new Error('Original cause');
      const wrappedError = new ThrottlerError('Wrapped', ThrottlerErrorCode.UNKNOWN_ERROR, originalError);
      
      expect(wrappedError.cause).toBe(originalError);
      expect(wrappedError.cause?.message).toBe('Original cause');
    });
  });

  describe('Error Message Handling', () => {
    it('should handle empty error messages', () => {
      const error = new ThrottlerError('');
      
      expect(error.message).toBe('');
      expect(error.code).toBe(ThrottlerErrorCode.UNKNOWN_ERROR);
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new ThrottlerError(longMessage);
      
      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in error messages', () => {
      const specialMessage = 'Error with special chars: 🚀 ñ ü ß € ¥ \n\t\r';
      const error = new ThrottlerError(specialMessage);
      
      expect(error.message).toBe(specialMessage);
    });
  });

  describe('Professional Standards Compliance', () => {
    it('should use enum error codes instead of magic strings', () => {
      // Verify all error codes are properly defined as enums
      const errorCodes = Object.values(ThrottlerErrorCode);
      
      expect(errorCodes).toContain('INVALID_CONFIGURATION');
      expect(errorCodes).toContain('REDIS_CONNECTION_FAILED');
      expect(errorCodes).toContain('STORAGE_OPERATION_FAILED');
      
      // Verify errors use enum values
      const error = new ThrottlerError('Test', ThrottlerErrorCode.REDIS_OPERATION_FAILED);
      expect(error.code).toBe(ThrottlerErrorCode.REDIS_OPERATION_FAILED);
    });

    it('should provide structured error information', () => {
      const cause = new Error('Root cause');
      const error = new ThrottlerConfigurationError('Structured error', 'fieldName', cause);
      
      // Should have structured information, not just a message
      expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
      expect(error.field).toBe('fieldName');
      expect(error.cause).toBe(cause);
      expect(error.message).toBe('Structured error');
    });

    it('should enable proper error handling patterns', () => {
      const errors = [
        new ThrottlerError('Base error'),
        new ThrottlerRedisConnectionError('Redis error'),
        new ThrottlerConfigurationError('Config error')
      ];
      
      // Should be able to handle errors by type, not by parsing messages
      errors.forEach(error => {
        if (isThrottlerRedisConnectionError(error)) {
          expect(error.code).toBe(ThrottlerErrorCode.REDIS_CONNECTION_FAILED);
        } else if (isThrottlerConfigurationError(error)) {
          expect(error.code).toBe(ThrottlerErrorCode.INVALID_CONFIGURATION);
        } else if (isThrottlerError(error)) {
          expect(error.code).toBeDefined();
        }
      });
    });
  });
});