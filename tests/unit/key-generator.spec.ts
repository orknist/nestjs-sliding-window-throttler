/**
 * @fileoverview Unit tests for KeyGenerator
 *
 * Tests key generation patterns, validation, member generation and parsing,
 * and different key generation strategies.
 */

import { KeyGenerator, KeyGenerationStrategy, KeyType } from '../../src/core/key-generator';

describe('KeyGenerator Unit Tests', () => {
  describe('Constructor and Configuration', () => {
    it('should create KeyGenerator with default settings', () => {
      const generator = new KeyGenerator();
      
      // Test that it generates keys (we can't access private properties directly)
      const keys = generator.generateKeys('user123', 'api');
      expect(keys.zKey).toContain('throttle');
      expect(keys.blockKey).toContain('throttle');
    });

    it('should create KeyGenerator with custom prefix', () => {
      const generator = new KeyGenerator({ prefix: 'custom_prefix' });
      
      const keys = generator.generateKeys('user123', 'api');
      expect(keys.zKey).toContain('custom_prefix');
      expect(keys.blockKey).toContain('custom_prefix');
    });

    it('should create KeyGenerator with simple strategy', () => {
      const generator = new KeyGenerator({ strategy: KeyGenerationStrategy.SIMPLE });
      
      const keys = generator.generateKeys('user123', 'api');
      // Simple strategy should not contain hash tags
      expect(keys.zKey).not.toContain('{');
      expect(keys.zKey).not.toContain('}');
    });

    it('should create KeyGenerator with cluster-safe strategy', () => {
      const generator = new KeyGenerator({ strategy: KeyGenerationStrategy.CLUSTER_SAFE });
      
      const keys = generator.generateKeys('user123', 'api');
      // Cluster-safe strategy should contain hash tags
      expect(keys.zKey).toContain('{');
      expect(keys.zKey).toContain('}');
    });

    it('should handle empty prefix by using default', () => {
      const generator = new KeyGenerator({ prefix: '' });
      
      const keys = generator.generateKeys('user123', 'api');
      expect(keys.zKey).toContain('throttle'); // Should use default
    });

    it('should handle whitespace-only prefix by using default', () => {
      const generator = new KeyGenerator({ prefix: '   ' });
      
      const keys = generator.generateKeys('user123', 'api');
      expect(keys.zKey).toContain('throttle'); // Should use default
    });
  });

  describe('Key Generation - Cluster Safe Strategy', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator({ 
        prefix: 'test_throttle',
        strategy: KeyGenerationStrategy.CLUSTER_SAFE 
      });
    });

    it('should generate consistent keys for same inputs', () => {
      const keys1 = generator.generateKeys('user123', 'api');
      const keys2 = generator.generateKeys('user123', 'api');
      
      expect(keys1.zKey).toBe(keys2.zKey);
      expect(keys1.blockKey).toBe(keys2.blockKey);
    });

    it('should generate different keys for different identifiers', () => {
      const keys1 = generator.generateKeys('user123', 'api');
      const keys2 = generator.generateKeys('user456', 'api');
      
      expect(keys1.zKey).not.toBe(keys2.zKey);
      expect(keys1.blockKey).not.toBe(keys2.blockKey);
    });

    it('should generate different keys for different throttler names', () => {
      const keys1 = generator.generateKeys('user123', 'api');
      const keys2 = generator.generateKeys('user123', 'login');
      
      expect(keys1.zKey).not.toBe(keys2.zKey);
      expect(keys1.blockKey).not.toBe(keys2.blockKey);
    });

    it('should generate cluster-safe keys with hash tags', () => {
      const keys = generator.generateKeys('user123', 'api');
      
      expect(keys.zKey).toMatch(/test_throttle:\{user123_api\}:z/);
      expect(keys.blockKey).toMatch(/test_throttle:\{user123_api\}:block/);
    });

    it('should include correct key types', () => {
      const keys = generator.generateKeys('user123', 'api');
      
      expect(keys.zKey).toContain(`:${KeyType.SLIDING_WINDOW}`);
      expect(keys.blockKey).toContain(`:${KeyType.BLOCK}`);
    });

    it('should use custom prefix when provided', () => {
      const keys = generator.generateKeys('user123', 'api', 'custom');
      
      expect(keys.zKey).toContain('custom:');
      expect(keys.blockKey).toContain('custom:');
    });

    it('should sanitize special characters in identifiers', () => {
      const keys = generator.generateKeys('user@123#test', 'api:v1');
      
      // Should not contain original special characters in the hash tag part
      const hashTagMatch = keys.zKey.match(/\{([^}]+)\}/);
      const hashTagContent = hashTagMatch ? hashTagMatch[1] : '';
      
      expect(hashTagContent).not.toContain('@');
      expect(hashTagContent).not.toContain('#');
      expect(hashTagContent).not.toContain(':');
      
      // Should contain sanitized versions
      expect(keys.zKey).toContain('_at_');
      expect(keys.zKey).toContain('_hash_');
    });
  });

  describe('Key Generation - Simple Strategy', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator({ 
        prefix: 'test_throttle',
        strategy: KeyGenerationStrategy.SIMPLE 
      });
    });

    it('should generate simple keys without hash tags', () => {
      const keys = generator.generateKeys('user123', 'api');
      
      expect(keys.zKey).toMatch(/test_throttle:user123:api:z/);
      expect(keys.blockKey).toMatch(/test_throttle:user123:api:block/);
      
      // Should not contain hash tags
      expect(keys.zKey).not.toContain('{');
      expect(keys.zKey).not.toContain('}');
    });

    it('should maintain consistency with simple strategy', () => {
      const keys1 = generator.generateKeys('user123', 'api');
      const keys2 = generator.generateKeys('user123', 'api');
      
      expect(keys1.zKey).toBe(keys2.zKey);
      expect(keys1.blockKey).toBe(keys2.blockKey);
    });
  });

  describe('Member Generation and Parsing', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator();
    });

    it('should generate member with timestamp and unique ID', () => {
      const timestamp = Date.now();
      const member = generator.generateMember(timestamp);
      
      expect(member).toMatch(/^\d+:[a-z0-9]{6}$/);
      expect(member).toContain(timestamp.toString());
    });

    it('should generate member with custom unique ID', () => {
      const timestamp = Date.now();
      const uniqueId = 'custom123';
      const member = generator.generateMember(timestamp, uniqueId);
      
      expect(member).toBe(`${timestamp}:${uniqueId}`);
    });

    it('should generate different members for same timestamp', () => {
      const timestamp = Date.now();
      const member1 = generator.generateMember(timestamp);
      const member2 = generator.generateMember(timestamp);
      
      expect(member1).not.toBe(member2);
      expect(member1.split(':')[0]).toBe(member2.split(':')[0]); // Same timestamp
      expect(member1.split(':')[1]).not.toBe(member2.split(':')[1]); // Different ID
    });

    it('should parse valid member correctly', () => {
      const timestamp = 1234567890123;
      const uniqueId = 'abc123';
      const member = `${timestamp}:${uniqueId}`;
      
      const parsed = generator.parseMember(member);
      
      expect(parsed).toEqual({
        timestamp: 1234567890123,
        uniqueId: 'abc123'
      });
    });

    it('should return null for invalid member format', () => {
      expect(generator.parseMember('invalid')).toBeNull();
      expect(generator.parseMember('123')).toBeNull();
      expect(generator.parseMember('123:456:789')).toBeNull();
      expect(generator.parseMember('')).toBeNull();
    });

    it('should return null for non-numeric timestamp', () => {
      expect(generator.parseMember('abc:123')).toBeNull();
      expect(generator.parseMember('NaN:123')).toBeNull();
    });

    it('should handle empty unique ID', () => {
      const parsed = generator.parseMember('1234567890:');
      
      expect(parsed).toEqual({
        timestamp: 1234567890,
        uniqueId: ''
      });
    });
  });

  describe('Key Validation', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator();
    });

    it('should validate normal keys as valid', () => {
      expect(generator.validateKey('throttle:user123:api:z')).toBe(true);
      expect(generator.validateKey('test_prefix:identifier:throttler:block')).toBe(true);
    });

    it('should reject empty keys', () => {
      expect(generator.validateKey('')).toBe(false);
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(513); // Exceeds MAX_KEY_LENGTH of 512
      expect(generator.validateKey(longKey)).toBe(false);
    });

    it('should accept keys at maximum length', () => {
      const maxLengthKey = 'a'.repeat(512);
      expect(generator.validateKey(maxLengthKey)).toBe(true);
    });

    it('should reject keys with forbidden characters', () => {
      expect(generator.validateKey('key\rwith\rcarriage\rreturn')).toBe(false);
      expect(generator.validateKey('key\nwith\nnewline')).toBe(false);
      expect(generator.validateKey('key\twith\ttab')).toBe(false);
      expect(generator.validateKey('key\0with\0null')).toBe(false);
    });

    it('should accept keys with allowed special characters', () => {
      expect(generator.validateKey('key:with:colons')).toBe(true);
      expect(generator.validateKey('key-with-dashes')).toBe(true);
      expect(generator.validateKey('key_with_underscores')).toBe(true);
      expect(generator.validateKey('key{with}braces')).toBe(true);
    });
  });

  describe('Component Sanitization', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator();
    });

    it('should sanitize email addresses correctly', () => {
      const keys = generator.generateKeys('user@example.com', 'api');
      
      expect(keys.zKey).toContain('user_at_example.com');
      expect(keys.zKey).not.toContain('@');
    });

    it('should sanitize hash symbols correctly', () => {
      const keys = generator.generateKeys('user#123', 'api');
      
      expect(keys.zKey).toContain('user_hash_123');
      expect(keys.zKey).not.toContain('#');
    });

    it('should replace spaces with underscores', () => {
      const keys = generator.generateKeys('user name', 'api endpoint');
      
      expect(keys.zKey).toContain('user_name');
      expect(keys.zKey).toContain('api_endpoint');
      expect(keys.zKey).not.toContain(' ');
    });

    it('should convert to lowercase', () => {
      const keys = generator.generateKeys('USER123', 'API');
      
      expect(keys.zKey).toContain('user123');
      expect(keys.zKey).toContain('api');
      expect(keys.zKey).not.toMatch(/[A-Z]/);
    });

    it('should handle empty components after sanitization', () => {
      const keys = generator.generateKeys('\r\n\t', '\0');
      
      // Should use 'sanitized' as fallback
      expect(keys.zKey).toContain('sanitized');
      expect(keys.blockKey).toContain('sanitized');
    });

    it('should truncate very long components', () => {
      const longIdentifier = 'a'.repeat(150);
      const keys = generator.generateKeys(longIdentifier, 'api');
      
      // Should be truncated to 100 characters - check the hash tag content
      const hashTagMatch = keys.zKey.match(/\{([^}]+)\}/);
      const hashTagContent = hashTagMatch ? hashTagMatch[1] : '';
      const identifierPart = hashTagContent.split('_')[0];
      expect(identifierPart?.length).toBeLessThanOrEqual(100);
    });

    it('should remove forbidden characters completely', () => {
      const keys = generator.generateKeys('user\r\n\t\0test', 'api');
      
      expect(keys.zKey).not.toContain('\r');
      expect(keys.zKey).not.toContain('\n');
      expect(keys.zKey).not.toContain('\t');
      expect(keys.zKey).not.toContain('\0');
      expect(keys.zKey).toContain('usertest');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator();
    });

    it('should handle numeric identifiers', () => {
      const keys = generator.generateKeys('12345', '67890');
      
      expect(keys.zKey).toContain('12345');
      expect(keys.zKey).toContain('67890');
    });

    it('should handle special Unicode characters', () => {
      const keys = generator.generateKeys('user🚀', 'api✨');
      
      // Should generate valid keys without throwing errors
      expect(keys.zKey).toBeDefined();
      expect(keys.blockKey).toBeDefined();
      expect(generator.validateKey(keys.zKey)).toBe(true);
      expect(generator.validateKey(keys.blockKey)).toBe(true);
    });

    it('should handle very short identifiers', () => {
      const keys = generator.generateKeys('a', 'b');
      
      expect(keys.zKey).toContain('a');
      expect(keys.zKey).toContain('b');
    });

    it('should generate unique IDs with correct format', () => {
      const uniqueIds = new Set<string>();
      
      // Generate 100 unique IDs to test uniqueness
      for (let i = 0; i < 100; i++) {
        const member = generator.generateMember(Date.now());
        const uniqueId = member.split(':')[1];
        
        expect(uniqueId).toMatch(/^[a-z0-9]{6}$/);
        uniqueIds.add(uniqueId);
      }
      
      // Should have generated mostly unique IDs (allowing for small chance of collision)
      expect(uniqueIds.size).toBeGreaterThan(95);
    });
  });

  describe('Key Type Enum Usage', () => {
    it('should use KeyType enum values correctly', () => {
      expect(KeyType.SLIDING_WINDOW).toBe('z');
      expect(KeyType.BLOCK).toBe('block');
    });

    it('should use KeyGenerationStrategy enum values correctly', () => {
      expect(KeyGenerationStrategy.SIMPLE).toBe('simple');
      expect(KeyGenerationStrategy.CLUSTER_SAFE).toBe('cluster-safe');
    });
  });
});