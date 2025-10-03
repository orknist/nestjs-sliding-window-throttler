import { RedisFailureStrategy } from './enums';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface ThrottlerOptions {
  failureStrategy: RedisFailureStrategy;
  keyPrefix?: string;
  enableDebugLogging?: boolean;
  maxWindowSize?: number;
  enableRedisFunctions?: boolean;
}

export interface ThrottlerConfig {
  redis: RedisConfig;
  throttler: ThrottlerOptions;
}
