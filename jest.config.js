// Jest configuration for Unit Tests
// Tests individual components in isolation with mocked dependencies
// Location: tests/unit/**/*.spec.ts
module.exports = {
  displayName: 'Unit Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 5000, // Reduced for fast unit tests
  // Performance optimizations for unit tests
  maxWorkers: '50%', // Allow parallel execution for unit tests
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  // Memory management
  logHeapUsage: false, // Disable for unit tests to reduce noise
  workerIdleMemoryLimit: '512MB',
  // Reduce test noise
  verbose: false,
  silent: true,
};