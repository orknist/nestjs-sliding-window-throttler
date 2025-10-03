// Jest configuration for Integration Tests
// Tests multiple components with real Redis using Docker
// Location: tests/integration/**/*.spec.ts
// Uses: createIntegrationTestEnvironment() helper for Redis setup
module.exports = {
  displayName: 'Integration Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Sequential execution for Redis containers
  detectOpenHandles: true,
  forceExit: true,
  globalSetup: '<rootDir>/tests/integration/global-setup.ts',
  globalTeardown: '<rootDir>/tests/integration/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Performance optimizations
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-integration',
  // Memory management for integration tests
  logHeapUsage: true,
  workerIdleMemoryLimit: '256MB',
  // Reduce test noise
  verbose: false,
  silent: true,
};