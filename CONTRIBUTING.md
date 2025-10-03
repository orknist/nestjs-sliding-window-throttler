# Contributing to NestJS Sliding Window Throttler

Thank you for your interest in contributing to `nestjs-sliding-window-throttler`! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@example.com](mailto:conduct@example.com).

## Getting Started

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Redis or Valkey**: 7.0.0 or higher (for testing)
- **Git**: Latest version

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nestjs-sliding-window-throttler.git
   cd nestjs-sliding-window-throttler
   ```

3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/orknist/nestjs-sliding-window-throttler.git
   ```

## Development Setup

### Install Dependencies

```bash
# Install all dependencies
npm install

# Install Redis for testing (if not already installed)
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Or use Docker
docker run -d -p 6379:6379 --name redis-dev redis:7-alpine

# Or use Valkey as an alternative
docker run -d -p 6379:6379 --name valkey-dev valkey/valkey:7-alpine
```

### Environment Setup

Create a `.env` file for development:

```bash
# Development environment
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
FAILURE_STRATEGY=fail-open
ENABLE_DEBUG_LOGGING=true
MAX_WINDOW_SIZE=1000
```

### Verify Setup

```bash
# Run tests to verify setup
npm test

# Run integration tests (requires Redis)
npm run test:integration

# Build the project
npm run build

# Check code quality
npm run lint
npm run format:check
```

## Contributing Guidelines

### Types of Contributions

We welcome the following types of contributions:

- **Bug fixes**: Fix issues in the codebase
- **Features**: Add new functionality
- **Documentation**: Improve or add documentation
- **Tests**: Add or improve test coverage
- **Performance**: Optimize existing code
- **Refactoring**: Improve code structure without changing functionality

### Before You Start

1. **Check existing issues**: Look for existing issues or discussions
2. **Create an issue**: For new features or significant changes, create an issue first
3. **Discuss**: Engage with maintainers and community before starting work
4. **Small changes**: For small bug fixes, you can directly create a PR

### Coding Standards

#### TypeScript Guidelines

- Use **TypeScript** for all code
- Follow **strict** TypeScript configuration
- Use **explicit types** where beneficial
- Avoid `any` type unless absolutely necessary
- Use **interfaces** for object shapes
- Use **enums** for constants with multiple values

```typescript
// ✅ Good
interface ThrottlerConfig {
  limit: number;
  ttl: number;
  blockDuration?: number;
}

enum FailureStrategy {
  FAIL_OPEN = 'fail-open',
  FAIL_CLOSED = 'fail-closed'
}

// ❌ Bad
const config: any = { limit: 10, ttl: 60000 };
const strategy = 'fail-open'; // Use enum instead
```

#### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Use **trailing commas** in objects and arrays
- Use **semicolons** at the end of statements
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces

```typescript
// ✅ Good
export class SlidingWindowThrottlerStorage implements ThrottlerStorage {
  private readonly config: ThrottlerConfig;
  
  constructor(
    private readonly redis: Redis,
    config: ThrottlerConfig,
  ) {
    this.config = config;
  }
  
  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    // Implementation
  }
}

// ❌ Bad
export class slidingWindowThrottlerStorage {
  private config
  
  constructor(redis, config) {
    this.config = config
  }
}
```

#### Documentation

- Use **JSDoc** comments for all public APIs
- Include **examples** in documentation
- Document **parameters** and **return types**
- Add **@throws** for methods that can throw errors

```typescript
/**
 * Increments the request count for a given key and returns throttling information.
 * 
 * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param ttl - Time-to-live for the sliding window in milliseconds
 * @param limit - Maximum number of requests allowed in the window
 * @param blockDuration - Duration to block requests after limit exceeded (0 = no blocking)
 * @param throttlerName - Name of the throttler configuration
 * 
 * @returns Promise resolving to throttling information
 * 
 * @throws {RedisConnectionError} When Redis connection fails
 * @throws {RateLimitExceededError} When rate limit is exceeded and fail-closed strategy is used
 * 
 * @example
 * ```typescript
 * const result = await storage.increment('user:123', 60000, 10, 30000, 'api-throttler');
 * console.log(`Hits: ${result.totalHits}, Blocked: ${result.isBlocked}`);
 * ```
 */
async increment(
  key: string,
  ttl: number,
  limit: number,
  blockDuration: number,
  throttlerName: string,
): Promise<ThrottlerStorageRecord> {
  // Implementation
}
```

### Git Workflow

#### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `test/` - Test improvements
- `refactor/` - Code refactoring
- `perf/` - Performance improvements

Examples:
- `feature/block-duration-support`
- `fix/redis-connection-retry`
- `docs/configuration-guide`
- `test/integration-test-coverage`

#### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(storage): add block duration support

Add support for temporarily blocking requests after rate limit is exceeded.
This provides better protection against abuse while maintaining usability.

Closes #123
```

```
fix(redis): handle connection failures gracefully

Improve error handling when Redis connection fails by implementing
exponential backoff retry strategy.

Fixes #456
```

## Pull Request Process

### Before Submitting

1. **Update your fork**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following the coding standards

4. **Test your changes**:
   ```bash
   npm test
   npm run test:integration
   npm run test:e2e
   ```

5. **Update documentation** if needed

6. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Submitting the PR

1. **Create a Pull Request** on GitHub
2. **Fill out the PR template** completely
3. **Link related issues** using keywords (e.g., "Closes #123")
4. **Request review** from maintainers
5. **Respond to feedback** promptly

### PR Requirements

- [ ] **Tests**: All tests pass
- [ ] **Coverage**: New code has appropriate test coverage
- [ ] **Documentation**: Updated if needed
- [ ] **Linting**: Code passes all linting checks
- [ ] **Changelog**: Updated if needed (for significant changes)
- [ ] **Breaking Changes**: Documented if any

### PR Template

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues
Closes #(issue number)
```

## Testing

### Test Structure

We use a comprehensive testing strategy:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions with real Redis
- **E2E Tests**: Test complete workflows with NestJS application

### Writing Tests

#### Unit Tests

```typescript
// storage.spec.ts
describe('SlidingWindowThrottlerStorage', () => {
  let storage: SlidingWindowThrottlerStorage;
  let mockRedis: jest.Mocked<Redis>;
  let mockFunctionsManager: jest.Mocked<RedisFunctionsManager>;

  beforeEach(() => {
    mockRedis = {
      fcall: jest.fn(),
      exists: jest.fn(),
      pttl: jest.fn(),
    } as any;

    mockFunctionsManager = {
      executeSlidingWindow: jest.fn(),
      isLoaded: jest.fn().mockReturnValue(true),
    } as any;

    storage = new SlidingWindowThrottlerStorage(
      mockRedis,
      mockConfig,
      mockFunctionsManager,
      mockKeyGenerator,
    );
  });

  describe('increment', () => {
    it('should return correct throttling information', async () => {
      // Arrange
      mockFunctionsManager.executeSlidingWindow.mockResolvedValue([5, 55, 0, -1]);

      // Act
      const result = await storage.increment('user:123', 60000, 10, 0, 'test');

      // Assert
      expect(result).toEqual({
        totalHits: 5,
        timeToExpire: 55,
        isBlocked: false,
        timeToBlockExpire: -1,
      });
    });
  });
});
```

#### Integration Tests

```typescript
// storage.integration.spec.ts
describe('SlidingWindowThrottlerStorage Integration', () => {
  let storage: SlidingWindowThrottlerStorage;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      db: 15, // Use separate test database
    });

    // Setup storage with real Redis
    storage = new SlidingWindowThrottlerStorage(
      redis,
      testConfig,
      functionsManager,
      keyGenerator,
    );
  });

  beforeEach(async () => {
    await redis.flushdb(); // Clean database before each test
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  it('should handle real Redis operations', async () => {
    // Test with real Redis
    const result = await storage.increment('test:key', 60000, 5, 0, 'test');
    expect(result.totalHits).toBe(1);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- storage.spec.ts

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

Maintain high test coverage:

- **Minimum**: 90% overall coverage
- **Critical paths**: 95% coverage
- **New code**: 95% coverage required

```bash
# Check coverage
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## Documentation

### Types of Documentation

1. **API Documentation**: Generated from JSDoc comments
2. **User Guides**: Markdown files in `/docs`
3. **Examples**: Code examples in `/examples`
4. **README**: Main project documentation

### Writing Documentation

#### API Documentation

Use JSDoc comments for all public APIs:

```typescript
/**
 * Configuration options for the sliding window throttler.
 * 
 * @public
 */
export interface SlidingWindowThrottlerConfig {
  /**
   * Redis connection configuration.
   * 
   * @example
   * ```typescript
   * redis: {
   *   host: 'localhost',
   *   port: 6379,
   *   password: 'secret'
   * }
   * ```
   */
  redis: RedisConfiguration;
  
  /**
   * Strategy to use when Redis is unavailable.
   * 
   * @defaultValue 'fail-open'
   */
  failureStrategy: FailureStrategy;
}
```

#### User Guides

Write clear, comprehensive guides:

- Use **clear headings** and structure
- Include **code examples** for all concepts
- Provide **troubleshooting** sections
- Add **links** to related documentation

#### Examples

Create practical, runnable examples:

```typescript
// examples/basic-usage/app.module.ts
import { Module } from '@nestjs/common';
import { SlidingWindowThrottlerModule } from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      failureStrategy: 'fail-open',
    }),
  ],
})
export class AppModule {}
```

### Generating Documentation

```bash
# Generate API documentation
npm run docs

# Serve documentation locally
npm run docs:serve

# Generate markdown documentation
npm run docs:markdown
```

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with new changes
3. **Run all tests** and ensure they pass
4. **Update documentation** if needed
5. **Create release PR** for review
6. **Tag release** after merge
7. **Publish to npm** (automated via CI/CD)

### Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- Block duration support for temporary blocking after rate limit exceeded
- New configuration helpers for different environments
- Comprehensive health check endpoints

### Changed
- Improved error handling with specific error types
- Enhanced logging with structured context

### Fixed
- Redis connection retry logic
- Memory leak in key cleanup process

### Deprecated
- Old configuration format (will be removed in v2.0.0)

## [1.1.0] - 2023-12-01
...
```

## Getting Help

### Community Support

- **GitHub Discussions**: For questions and community support
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: Join our community Discord server
- **Stack Overflow**: Tag questions with `nestjs-sliding-window-throttler`

### Maintainer Contact

- **Email**: [maintainers@example.com](mailto:maintainers@example.com)
- **Twitter**: [@nestjs_throttler](https://twitter.com/nestjs_throttler)

### Response Times

We aim to respond to:
- **Security issues**: Within 24 hours
- **Bug reports**: Within 3-5 business days
- **Feature requests**: Within 1-2 weeks
- **Questions**: Within 1 week

## Recognition

Contributors will be recognized in:

- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graphs and statistics
- **Social Media**: Shout-outs for significant contributions

## License

By contributing to this project, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

---

Thank you for contributing to `nestjs-sliding-window-throttler`! Your contributions help make this project better for everyone. 🚀