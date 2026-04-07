# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-04-07

### Added
- Comprehensive algorithm documentation in `docs/algorithm.md`
- Performance comparison section highlighting single atomic Redis operation advantage
- Detailed benchmarks showing 50% lower latency vs standard throttlers
- "Why This Package?" section in README explaining performance and accuracy benefits

### Changed
- Enhanced README with performance metrics (1ms vs 2-3ms latency)
- Updated feature descriptions to emphasize ultra-fast performance
- Improved algorithm comparison table with detailed metrics
- Clarified that this is a "true sliding window" implementation (not approximated)
- Updated package description to highlight performance advantages
- Added performance-related keywords to package.json

### Documentation
- Added detailed explanation of single atomic operation vs multiple Redis calls
- Included real-world performance benchmarks
- Added comparison with Cloudflare and Upstash approximated implementations
- Enhanced production tips with performance considerations

## [1.0.0] - 2025-10-03

### Added
- Initial package structure and development environment setup
- TypeScript configuration for library compilation
- ESLint and Prettier configuration for code quality
- Jest configuration for unit, integration, and e2e testing
- Basic project structure with placeholder files
- Comprehensive README with usage examples
- MIT license

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Deprecated
- Nothing yet

### Removed
- Nothing yet

### Fixed
- Nothing yet

### Security
- Nothing yet
