#!/usr/bin/env node

/**
 * @fileoverview Combine coverage reports from different test types
 * 
 * This script merges coverage reports from unit, integration, and e2e tests
 * into a single comprehensive coverage report.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COVERAGE_DIR = 'coverage';
const COMBINED_DIR = path.join(COVERAGE_DIR, 'combined');

/**
 * Check if a directory exists
 */
function dirExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dir) {
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy coverage files for merging
 */
function prepareCoverageFiles() {
  const testTypes = ['unit', 'integration', 'e2e'];
  const coverageFiles = [];

  for (const testType of testTypes) {
    const coverageFile = path.join(COVERAGE_DIR, testType, 'coverage-final.json');
    
    if (fs.existsSync(coverageFile)) {
      const targetFile = path.join(COMBINED_DIR, `coverage-${testType}.json`);
      fs.copyFileSync(coverageFile, targetFile);
      coverageFiles.push(targetFile);
      console.log(`✅ Found coverage for ${testType} tests`);
    } else {
      console.log(`⚠️  No coverage found for ${testType} tests`);
    }
  }

  return coverageFiles;
}

/**
 * Merge coverage reports using nyc
 */
function mergeCoverage(coverageFiles) {
  if (coverageFiles.length === 0) {
    console.log('❌ No coverage files found to merge');
    process.exit(1);
  }

  try {
    // Check if nyc is available
    execSync('npx nyc --version', { stdio: 'ignore' });
  } catch {
    console.log('❌ nyc not found. Installing...');
    execSync('npm install --save-dev nyc', { stdio: 'inherit' });
  }

  console.log('🔄 Merging coverage reports...');

  // Merge coverage files
  const nycCommand = [
    'npx nyc merge',
    COMBINED_DIR,
    path.join(COMBINED_DIR, 'coverage-merged.json')
  ].join(' ');

  execSync(nycCommand, { stdio: 'inherit' });

  // Generate reports
  const reportCommand = [
    'npx nyc report',
    `--temp-dir ${COMBINED_DIR}`,
    `--report-dir ${COMBINED_DIR}`,
    '--reporter=text',
    '--reporter=html',
    '--reporter=lcov'
  ].join(' ');

  execSync(reportCommand, { stdio: 'inherit' });

  console.log('✅ Combined coverage report generated');
  console.log(`📊 View HTML report: ${path.join(COMBINED_DIR, 'index.html')}`);
}

/**
 * Clean up temporary files
 */
function cleanup() {
  const tempFiles = [
    'coverage-unit.json',
    'coverage-integration.json',
    'coverage-e2e.json',
    'coverage-merged.json'
  ];

  for (const file of tempFiles) {
    const filePath = path.join(COMBINED_DIR, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Combining coverage reports...\n');

  // Ensure directories exist
  ensureDir(COMBINED_DIR);

  // Prepare coverage files
  const coverageFiles = prepareCoverageFiles();

  if (coverageFiles.length > 0) {
    // Merge coverage
    mergeCoverage(coverageFiles);

    // Cleanup
    cleanup();

    console.log('\n✅ Coverage combination complete!');
  } else {
    console.log('\n❌ No coverage reports found. Run tests with coverage first:');
    console.log('   npm run test:coverage');
    console.log('   npm run test:integration -- --coverage');
    console.log('   npm run test:e2e -- --coverage');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };