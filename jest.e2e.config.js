// Jest configuration for E2E Tests
// Tests complete application scenarios with external Redis
// Location: tests/e2e/**/*.e2e-spec.ts
// Uses: createE2ETestEnvironment() helper for full NestJS application
module.exports = {
  displayName: 'E2E Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/e2e/**/*.e2e-spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage/e2e',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 20000, // 20 seconds for E2E tests
  maxWorkers: 1, // Sequential execution for E2E tests
  detectOpenHandles: true,
  forceExit: true,
  globalSetup: '<rootDir>/tests/e2e/global-setup.ts',
  globalTeardown: '<rootDir>/tests/e2e/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-e2e',
  // Memory management for E2E tests
  logHeapUsage: true,
  workerIdleMemoryLimit: '256MB',
  // Reduce test noise
  verbose: false,
  silent: true,
};