/**
 * @fileoverview Simplified Redis key generator for sliding window throttler
 *
 * This module provides essential Redis key generation functionality with
 * basic validation and Redis cluster compatibility through hash tags.
 */

/**
 * Key generation strategy options
 */
export enum KeyGenerationStrategy {
  /** Simple concatenation of components */
  SIMPLE = 'simple',
  /** Cluster-safe key generation with hash tags */
  CLUSTER_SAFE = 'cluster-safe',
}

/**
 * Types of keys used in the sliding window implementation
 */
export enum KeyType {
  /** ZSET key for storing request timestamps */
  SLIDING_WINDOW = 'z',
  /** String key for storing block status */
  BLOCK = 'block',
}

export interface SlidingWindowMember {
  timestamp: number;
  uniqueId: string;
}

/**
 * Redis key generator for sliding window throttler
 */
export class KeyGenerator {
  private static readonly DEFAULT_PREFIX = 'throttle';
  private static readonly MAX_KEY_LENGTH = 512;
  private static readonly FORBIDDEN_CHARS = ['\r', '\n', '\t', '\0'];

  private readonly prefix: string;
  private readonly strategy: KeyGenerationStrategy;

  constructor(
    options: {
      prefix?: string;
      strategy?: KeyGenerationStrategy;
    } = {},
  ) {
    this.prefix = (options.prefix && options.prefix.trim()) || KeyGenerator.DEFAULT_PREFIX;
    this.strategy = options.strategy || KeyGenerationStrategy.CLUSTER_SAFE;
  }

  generateKeys(identifier: string, throttlerName: string, prefix?: string): { zKey: string; blockKey: string } {
    const effectivePrefix = prefix || this.prefix;
    const sanitizedIdentifier = this.sanitizeComponent(identifier);
    const sanitizedThrottlerName = this.sanitizeComponent(throttlerName);
    const sanitizedPrefix = this.sanitizeComponent(effectivePrefix);

    if (this.strategy === KeyGenerationStrategy.CLUSTER_SAFE) {
      const hashTag = `${sanitizedIdentifier}_${sanitizedThrottlerName}`;
      return {
        zKey: `${sanitizedPrefix}:{${hashTag}}:${KeyType.SLIDING_WINDOW}`,
        blockKey: `${sanitizedPrefix}:{${hashTag}}:${KeyType.BLOCK}`,
      };
    }

    // Simple strategy
    return {
      zKey: `${sanitizedPrefix}:${sanitizedIdentifier}:${sanitizedThrottlerName}:${KeyType.SLIDING_WINDOW}`,
      blockKey: `${sanitizedPrefix}:${sanitizedIdentifier}:${sanitizedThrottlerName}:${KeyType.BLOCK}`,
    };
  }

  /**
   * Generate a compact member for ZSET entries
   *
   * Creates a unique member string that combines timestamp with a random component
   * to prevent duplicate scores while keeping the member compact.
   *
   * @param timestamp - Unix timestamp in milliseconds
   * @param uniqueId - Optional unique identifier (auto-generated if not provided)
   * @returns Compact member string
   */
  generateMember(timestamp: number, uniqueId?: string): string {
    const id = uniqueId || this.generateUniqueId();
    return `${timestamp}:${id}`;
  }

  /**
   * Parse a member string back into its components
   *
   * @param member - Member string to parse
   * @returns Parsed member components or null if invalid
   */
  parseMember(member: string): SlidingWindowMember | null {
    const parts = member.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const timestampStr = parts[0];
    if (!timestampStr) {
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return null;
    }

    return {
      timestamp,
      uniqueId: parts[1] || '',
    };
  }

  /**
   * Validate a Redis key for basic format compliance
   *
   * @param key - Key to validate
   * @returns True if key is valid, false otherwise
   */
  validateKey(key: string): boolean {
    if (key.length === 0 || key.length > KeyGenerator.MAX_KEY_LENGTH) {
      return false;
    }

    // Check for forbidden characters
    for (const char of KeyGenerator.FORBIDDEN_CHARS) {
      if (key.includes(char)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize a key component with basic validation
   *
   * @param component - Component to sanitize
   * @returns Sanitized component
   */
  private sanitizeComponent(component: string): string {
    let sanitized = component;

    // Remove forbidden characters
    for (const char of KeyGenerator.FORBIDDEN_CHARS) {
      sanitized = sanitized.replace(new RegExp(this.escapeRegExp(char), 'g'), '');
    }

    // Replace problematic characters for hash tags
    sanitized = sanitized.replace(/:/g, '_').replace(/\s+/g, '_').replace(/@/g, '_at_').replace(/#/g, '_hash_').toLowerCase();

    // Ensure component is not empty after sanitization
    if (sanitized.length === 0) {
      sanitized = 'sanitized';
    }

    // Truncate if too long (leave room for other components)
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
  }

  /**
   * Generate a unique ID for ZSET members
   */
  private generateUniqueId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
