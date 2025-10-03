/**
 * @fileoverview Unit tests for SlidingWindowThrottlerLogger
 *
 * Tests logging functionality with mocked dependencies, console logger implementation,
 * and logger factory functionality.
 */

import { 
  SlidingWindowThrottlerLogger,
  SlidingWindowThrottlerConsoleLogger,
  SlidingWindowThrottlerLoggerFactory,
  SlidingWindowThrottlerConsoleLoggerFactory
} from '../../src/core/logger';

describe('SlidingWindowThrottlerLogger Unit Tests', () => {
  describe('SlidingWindowThrottlerConsoleLogger', () => {
    let consoleSpy: {
      debug: jest.SpyInstance;
      info: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpy = {
        debug: jest.spyOn(console, 'debug').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation()
      };
    });

    afterEach(() => {
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    describe('Debug Logging', () => {
      it('should log debug messages when debug is enabled', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger(true);
        
        logger.debug('Test debug message');
        
        expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] Test debug message', '');
      });

      it('should not log debug messages when debug is disabled', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger(false);
        
        logger.debug('Test debug message');
        
        expect(consoleSpy.debug).not.toHaveBeenCalled();
      });

      it('should log debug messages with context when debug is enabled', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger(true);
        const context = { userId: '123', operation: 'increment' };
        
        logger.debug('Test debug message', context);
        
        expect(consoleSpy.debug).toHaveBeenCalledWith(
          '[DEBUG] Test debug message',
          '{"userId":"123","operation":"increment"}'
        );
      });

      it('should default to debug disabled when not specified', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.debug('Test debug message');
        
        expect(consoleSpy.debug).not.toHaveBeenCalled();
      });
    });

    describe('Info Logging', () => {
      it('should log info messages', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.info('Test info message');
        
        expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] Test info message', '');
      });

      it('should log info messages with context', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const context = { config: 'loaded', status: 'ready' };
        
        logger.info('Configuration loaded', context);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          '[INFO] Configuration loaded',
          '{"config":"loaded","status":"ready"}'
        );
      });
    });

    describe('Warning Logging', () => {
      it('should log warning messages', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.warn('Test warning message');
        
        expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Test warning message', '');
      });

      it('should log warning messages with context', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const context = { retryCount: 3, maxRetries: 5 };
        
        logger.warn('Retry attempt', context);
        
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          '[WARN] Retry attempt',
          '{"retryCount":3,"maxRetries":5}'
        );
      });
    });

    describe('Error Logging', () => {
      it('should log error messages', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.error('Test error message');
        
        expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error message', '', '');
      });

      it('should log error messages with Error object', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const error = new Error('Something went wrong');
        
        logger.error('Operation failed', error);
        
        expect(consoleSpy.error).toHaveBeenCalledWith(
          '[ERROR] Operation failed',
          'Something went wrong',
          ''
        );
      });

      it('should log error messages with Error object and context', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const error = new Error('Redis connection failed');
        const context = { host: 'localhost', port: 6379 };
        
        logger.error('Connection error', error, context);
        
        expect(consoleSpy.error).toHaveBeenCalledWith(
          '[ERROR] Connection error',
          'Redis connection failed',
          '{"host":"localhost","port":6379}'
        );
      });

      it('should log error stack trace when available', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n    at test.js:1:1';
        
        logger.error('Stack trace test', error);
        
        expect(consoleSpy.error).toHaveBeenCalledTimes(2);
        expect(consoleSpy.error).toHaveBeenNthCalledWith(1, '[ERROR] Stack trace test', 'Test error', '');
        expect(consoleSpy.error).toHaveBeenNthCalledWith(2, 'Error: Test error\n    at test.js:1:1');
      });

      it('should handle missing error message gracefully', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.error('Test error message', undefined);
        
        expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error message', '', '');
      });
    });

    describe('Context Serialization', () => {
      it('should handle simple context objects', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const context = { key: 'value', number: 42, boolean: true };
        
        logger.info('Test message', context);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          '[INFO] Test message',
          '{"key":"value","number":42,"boolean":true}'
        );
      });

      it('should handle nested context objects', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const context = {
          user: { id: '123', name: 'John' },
          config: { enabled: true, timeout: 5000 }
        };
        
        logger.info('Nested context test', context);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          '[INFO] Nested context test',
          '{"user":{"id":"123","name":"John"},"config":{"enabled":true,"timeout":5000}}'
        );
      });

      it('should handle circular references in context', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        const context: Record<string, unknown> = { key: 'value' };
        context.circular = context; // Create circular reference
        
        logger.info('Circular reference test', context);
        
        expect(consoleSpy.info).toHaveBeenCalledWith(
          '[INFO] Circular reference test',
          '[Circular Reference]'
        );
      });

      it('should handle undefined context gracefully', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.info('No context test', undefined);
        
        expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] No context test', '');
      });

      it('should handle empty context object', () => {
        const logger = new SlidingWindowThrottlerConsoleLogger();
        
        logger.info('Empty context test', {});
        
        expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] Empty context test', '{}');
      });
    });
  });

  describe('SlidingWindowThrottlerConsoleLoggerFactory', () => {
    it('should create logger with debug disabled by default', () => {
      const factory = new SlidingWindowThrottlerConsoleLoggerFactory();
      const logger = factory.createLogger('test-logger');
      
      expect(logger).toBeInstanceOf(SlidingWindowThrottlerConsoleLogger);
      
      // Test that debug is disabled
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      logger.debug('Test debug');
      expect(debugSpy).not.toHaveBeenCalled();
      debugSpy.mockRestore();
    });

    it('should create logger with debug enabled when specified', () => {
      const factory = new SlidingWindowThrottlerConsoleLoggerFactory(true);
      const logger = factory.createLogger('test-logger');
      
      expect(logger).toBeInstanceOf(SlidingWindowThrottlerConsoleLogger);
      
      // Test that debug is enabled
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      logger.debug('Test debug');
      expect(debugSpy).toHaveBeenCalledWith('[DEBUG] Test debug', '');
      debugSpy.mockRestore();
    });

    it('should create multiple independent loggers', () => {
      const factory = new SlidingWindowThrottlerConsoleLoggerFactory();
      const logger1 = factory.createLogger('logger1');
      const logger2 = factory.createLogger('logger2');
      
      expect(logger1).toBeInstanceOf(SlidingWindowThrottlerConsoleLogger);
      expect(logger2).toBeInstanceOf(SlidingWindowThrottlerConsoleLogger);
      expect(logger1).not.toBe(logger2);
    });

    it('should ignore logger name parameter (implementation detail)', () => {
      const factory = new SlidingWindowThrottlerConsoleLoggerFactory();
      
      // Should not throw error with any logger name
      expect(() => factory.createLogger('any-name')).not.toThrow();
      expect(() => factory.createLogger('')).not.toThrow();
      expect(() => factory.createLogger('special-chars-!@#$%')).not.toThrow();
    });
  });

  describe('Logger Interface Compliance', () => {
    let logger: SlidingWindowThrottlerLogger;

    beforeEach(() => {
      logger = new SlidingWindowThrottlerConsoleLogger();
    });

    it('should implement all required interface methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should accept correct parameter types for debug', () => {
      expect(() => logger.debug('message')).not.toThrow();
      expect(() => logger.debug('message', {})).not.toThrow();
      expect(() => logger.debug('message', { key: 'value' })).not.toThrow();
    });

    it('should accept correct parameter types for info', () => {
      expect(() => logger.info('message')).not.toThrow();
      expect(() => logger.info('message', {})).not.toThrow();
      expect(() => logger.info('message', { key: 'value' })).not.toThrow();
    });

    it('should accept correct parameter types for warn', () => {
      expect(() => logger.warn('message')).not.toThrow();
      expect(() => logger.warn('message', {})).not.toThrow();
      expect(() => logger.warn('message', { key: 'value' })).not.toThrow();
    });

    it('should accept correct parameter types for error', () => {
      expect(() => logger.error('message')).not.toThrow();
      expect(() => logger.error('message', new Error('test'))).not.toThrow();
      expect(() => logger.error('message', new Error('test'), {})).not.toThrow();
      expect(() => logger.error('message', undefined, { key: 'value' })).not.toThrow();
    });
  });

  describe('Performance and Edge Cases', () => {
    let logger: SlidingWindowThrottlerConsoleLogger;

    beforeEach(() => {
      logger = new SlidingWindowThrottlerConsoleLogger(true);
    });

    it('should handle very large context objects', () => {
      const largeContext: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeContext[`key${i}`] = `value${i}`;
      }
      
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      
      expect(() => logger.info('Large context test', largeContext)).not.toThrow();
      expect(infoSpy).toHaveBeenCalled();
      
      infoSpy.mockRestore();
    });

    it('should handle special characters in messages', () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      logger.debug('Message with special chars: 🚀 ñ ü ß € ¥');
      
      expect(debugSpy).toHaveBeenCalledWith('[DEBUG] Message with special chars: 🚀 ñ ü ß € ¥', '');
      debugSpy.mockRestore();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      
      expect(() => logger.info(longMessage)).not.toThrow();
      expect(infoSpy).toHaveBeenCalledWith(`[INFO] ${longMessage}`, '');
      
      infoSpy.mockRestore();
    });

    it('should handle null and undefined values in context', () => {
      const context = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false
      };
      
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      
      logger.info('Null/undefined test', context);
      
      expect(infoSpy).toHaveBeenCalledWith(
        '[INFO] Null/undefined test',
        '{"nullValue":null,"emptyString":"","zero":0,"false":false}'
      );
      
      infoSpy.mockRestore();
    });

    it('should handle Date objects in context', () => {
      const context = {
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        now: new Date()
      };
      
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      
      logger.info('Date test', context);
      
      expect(infoSpy).toHaveBeenCalled();
      const serializedContext = infoSpy.mock.calls[0]?.[1] as string;
      expect(serializedContext).toContain('2023-01-01T00:00:00.000Z');
      
      infoSpy.mockRestore();
    });
  });

  describe('Factory Interface Compliance', () => {
    let factory: SlidingWindowThrottlerLoggerFactory;

    beforeEach(() => {
      factory = new SlidingWindowThrottlerConsoleLoggerFactory();
    });

    it('should implement createLogger method', () => {
      expect(typeof factory.createLogger).toBe('function');
    });

    it('should return logger that implements SlidingWindowThrottlerLogger interface', () => {
      const logger = factory.createLogger('test');
      
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});