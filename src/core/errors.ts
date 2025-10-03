import { ThrottlerErrorCode } from '../config/enums';
export { ThrottlerErrorCode };

export class ThrottlerError extends Error {
  constructor(
    message: string,
    public code: ThrottlerErrorCode = ThrottlerErrorCode.UNKNOWN_ERROR,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'ThrottlerError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ThrottlerError);
    }
  }
}

export class ThrottlerRedisConnectionError extends ThrottlerError {
  constructor(message: string, cause?: Error) {
    super(message, ThrottlerErrorCode.REDIS_CONNECTION_FAILED, cause);
    this.name = 'ThrottlerRedisConnectionError';
  }
}

export class ThrottlerConfigurationError extends ThrottlerError {
  constructor(
    message: string,
    public field?: string,
    cause?: Error,
  ) {
    super(message, ThrottlerErrorCode.INVALID_CONFIGURATION, cause);
    this.name = 'ThrottlerConfigurationError';
  }
}

export function isThrottlerError(error: unknown): error is ThrottlerError {
  return error instanceof ThrottlerError;
}

export function isThrottlerRedisConnectionError(error: unknown): error is ThrottlerRedisConnectionError {
  return error instanceof ThrottlerRedisConnectionError;
}

export function isThrottlerConfigurationError(error: unknown): error is ThrottlerConfigurationError {
  return error instanceof ThrottlerConfigurationError;
}
