/**
 * @fileoverview Configuration validation example
 * 
 * This example demonstrates how to validate configuration for different
 * environments and handle validation errors gracefully.
 */

import {
  createDevelopmentConfiguration,
  createProductionConfiguration,
  validateProductionReadiness,
  getConfigurationSummary,
  createSimpleThrottlerConfiguration,
  validateSimpleConfiguration,
} from 'nestjs-sliding-window-throttler';

// =============================================================================
// CONFIGURATION VALIDATION EXAMPLES
// =============================================================================

/**
 * Example 1: Development configuration validation
 */
export function validateDevelopmentConfiguration() {
  console.log('=== Development Configuration Validation ===');
  
  try {
    const config = createDevelopmentConfiguration({
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    });
    
    console.log('✅ Development configuration created successfully');
    console.log(getConfigurationSummary(config));
    
    const validation = validateProductionReadiness(config);
    if (validation.recommendations.length > 0) {
      console.log('\n⚠️  Recommendations for production:');
      validation.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
  } catch (error) {
    console.error('❌ Development configuration failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 2: Production configuration validation
 */
export function validateProductionConfiguration() {
  console.log('\n=== Production Configuration Validation ===');
  
  try {
    const config = createProductionConfiguration({
      REDIS_HOST: 'redis.example.com',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'secure-password',
      REDIS_TLS: 'true',
    });
    
    console.log('✅ Production configuration created successfully');
    
    const validation = validateProductionReadiness(config);
    
    if (validation.isReady) {
      console.log('✅ Configuration is production ready!');
    } else {
      console.log('❌ Configuration issues found:');
      validation.issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    if (validation.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      validation.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
  } catch (error) {
    console.error('❌ Production configuration failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 3: Invalid configuration handling
 */
export function handleInvalidConfiguration() {
  console.log('\n=== Invalid Configuration Handling ===');
  
  try {
    // This should fail validation
    const config = createSimpleThrottlerConfiguration({
      REDIS_HOST: '', // Invalid: empty host
      REDIS_PORT: '99999', // Invalid: port out of range
      FAILURE_STRATEGY: 'invalid-strategy', // Invalid: unknown strategy
    });
    
    console.log('❌ This should not succeed');
    
  } catch (error) {
    console.log('✅ Invalid configuration properly rejected:');
    console.log(`   ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Example 4: Environment-specific validation
 */
export function validateEnvironmentSpecificConfiguration() {
  console.log('\n=== Environment-Specific Configuration ===');
  
  const environments = [
    {
      name: 'Development',
      env: {
        NODE_ENV: 'development',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        ENABLE_DEBUG_LOGGING: 'true',
      },
    },
    {
      name: 'Staging',
      env: {
        NODE_ENV: 'staging',
        REDIS_HOST: 'redis-staging.example.com',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'staging-password',
        REDIS_TLS: 'true',
        ENABLE_DEBUG_LOGGING: 'false',
      },
    },
    {
      name: 'Production',
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'redis-prod.example.com',
        REDIS_PORT: '6380',
        REDIS_PASSWORD: 'production-password',
        REDIS_TLS: 'true',
        FAILURE_STRATEGY: 'fail-closed',
        ENABLE_DEBUG_LOGGING: 'false',
        LOG_LEVEL: 'warn',
      },
    },
  ];
  
  environments.forEach(({ name, env }) => {
    console.log(`\n--- ${name} Environment ---`);
    
    try {
      const config = createSimpleThrottlerConfiguration(env);
      const validation = validateSimpleConfiguration(config);
      
      console.log(`✅ ${name} configuration valid`);
      console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
      console.log(`   TLS: ${config.redis.tls ? 'enabled' : 'disabled'}`);
      console.log(`   Debug: ${config.development.enableDebugLogging ? 'enabled' : 'disabled'}`);
      
      if (validation.warnings.length > 0) {
        console.log('   ⚠️  Warnings:');
        validation.warnings.forEach(warning => console.log(`     • ${warning}`));
      }
      
    } catch (error) {
      console.log(`❌ ${name} configuration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Example 5: Configuration migration validation
 */
export function validateConfigurationMigration() {
  console.log('\n=== Configuration Migration Validation ===');
  
  // Legacy configuration format
  const legacyConfig = {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'legacy-password',
    },
    failureStrategy: 'fail-open',
    enableDebugLogging: true,
    maxWindowSize: 2000,
  };
  
  console.log('Legacy configuration:');
  console.log(JSON.stringify(legacyConfig, null, 2));
  
  try {
    // This would be handled by the module's legacy conversion
    const envVars = {
      REDIS_HOST: legacyConfig.redis.host,
      REDIS_PORT: legacyConfig.redis.port.toString(),
      REDIS_PASSWORD: legacyConfig.redis.password,
      FAILURE_STRATEGY: legacyConfig.failureStrategy,
      ENABLE_DEBUG_LOGGING: legacyConfig.enableDebugLogging.toString(),
      MAX_WINDOW_SIZE: legacyConfig.maxWindowSize.toString(),
    };
    
    const newConfig = createSimpleThrottlerConfiguration(envVars);
    
    console.log('\n✅ Migration successful!');
    console.log('New configuration structure:');
    console.log(`   Redis: ${newConfig.redis.host}:${newConfig.redis.port}`);
    console.log(`   Failure Strategy: ${newConfig.security.failureStrategy}`);
    console.log(`   Debug Logging: ${newConfig.development.enableDebugLogging}`);
    console.log(`   Max Window Size: ${newConfig.performance.maxWindowSize}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Run all validation examples
 */
export function runAllValidationExamples() {
  console.log('🔧 Configuration Validation Examples\n');
  
  validateDevelopmentConfiguration();
  validateProductionConfiguration();
  handleInvalidConfiguration();
  validateEnvironmentSpecificConfiguration();
  validateConfigurationMigration();
  
  console.log('\n✅ All validation examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllValidationExamples();
}