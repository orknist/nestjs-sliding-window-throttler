/**
 * @fileoverview Advanced configuration examples for sliding window throttler
 * 
 * This file demonstrates various configuration scenarios and best practices
 * for setting up the sliding window throttler in different environments.
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  SlidingWindowThrottlerModule,
  createDevelopmentConfiguration,
  createProductionConfiguration,
  createTestingConfiguration,
  createHighThroughputConfiguration,
  createSecurityFocusedConfiguration,
  validateProductionReadiness,
  getConfigurationSummary,
  migrateLegacyConfiguration,
} from 'nestjs-sliding-window-throttler';

// =============================================================================
// BASIC CONFIGURATION EXAMPLES
// =============================================================================

/**
 * Example 1: Simple development setup using environment variables
 */
@Module({
  imports: [
    // Use environment variables directly
    SlidingWindowThrottlerModule.forRoot(),
  ],
})
export class BasicDevelopmentModule {}

/**
 * Example 2: Explicit configuration object
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot({
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_KEY_PREFIX: 'myapp:throttle',
      FAILURE_STRATEGY: 'fail-open',
      ENABLE_DEBUG_LOGGING: 'true',
      LOG_LEVEL: 'debug',
    }),
  ],
})
export class ExplicitConfigModule {}

// =============================================================================
// ENVIRONMENT-SPECIFIC CONFIGURATIONS
// =============================================================================

/**
 * Example 3: Development configuration with helper
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createDevelopmentConfiguration({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_KEY_PREFIX: 'myapp:dev',
      }),
    ),
  ],
})
export class DevelopmentModule {}

/**
 * Example 4: Production configuration with security
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createProductionConfiguration({
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        REDIS_TLS: 'true',
        REDIS_KEY_PREFIX: 'myapp:prod',
        FAILURE_STRATEGY: 'fail-closed',
      }),
    ),
  ],
})
export class ProductionModule {}

/**
 * Example 5: Testing configuration
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createTestingConfiguration({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_DB: '15', // Separate test database
        REDIS_KEY_PREFIX: 'myapp:test',
      }),
    ),
  ],
})
export class TestingModule {}

// =============================================================================
// ASYNC CONFIGURATION EXAMPLES
// =============================================================================

/**
 * Example 6: Async configuration with ConfigService
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        
        if (isProduction) {
          return createProductionConfiguration({
            REDIS_HOST: configService.get('REDIS_HOST'),
            REDIS_PORT: configService.get('REDIS_PORT'),
            REDIS_PASSWORD: configService.get('REDIS_PASSWORD'),
            REDIS_TLS: configService.get('REDIS_TLS', 'true'),
          });
        } else {
          return createDevelopmentConfiguration({
            REDIS_HOST: configService.get('REDIS_HOST', 'localhost'),
            REDIS_PORT: configService.get('REDIS_PORT', '6379'),
          });
        }
      },
      inject: [ConfigService],
    }),
  ],
})
export class AsyncConfigModule {}

/**
 * Example 7: Dynamic configuration based on environment
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const environment = configService.get('NODE_ENV', 'development');
        const redisUrl = configService.get('REDIS_URL');
        
        // Parse Redis URL if provided
        let redisConfig = {};
        if (redisUrl) {
          const url = new URL(redisUrl);
          redisConfig = {
            REDIS_HOST: url.hostname,
            REDIS_PORT: url.port || '6379',
            REDIS_PASSWORD: url.password,
            REDIS_DB: url.pathname.slice(1) || '0',
          };
        }
        
        switch (environment) {
          case 'production':
            return createProductionConfiguration({
              ...redisConfig,
              REDIS_TLS: 'true',
              FAILURE_STRATEGY: 'fail-closed',
            });
            
          case 'staging':
            return createProductionConfiguration({
              ...redisConfig,
              ENABLE_DEBUG_LOGGING: 'true',
              LOG_LEVEL: 'info',
            });
            
          case 'test':
            return createTestingConfiguration(redisConfig);
            
          default:
            return createDevelopmentConfiguration(redisConfig);
        }
      },
      inject: [ConfigService],
    }),
  ],
})
export class DynamicConfigModule {}

// =============================================================================
// SPECIALIZED CONFIGURATION EXAMPLES
// =============================================================================

/**
 * Example 8: High-throughput configuration for busy APIs
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createHighThroughputConfiguration({
        REDIS_HOST: 'redis-cluster.example.com',
        REDIS_PORT: '6379',
        MAX_WINDOW_SIZE: '10000',
        CLEANUP_INTERVAL: '5m',
        ENABLE_BATCH_OPERATIONS: 'true',
      }),
    ),
  ],
})
export class HighThroughputModule {}

/**
 * Example 9: Security-focused configuration
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createSecurityFocusedConfiguration({
        REDIS_HOST: 'secure-redis.example.com',
        REDIS_PORT: '6380',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        REDIS_TLS: 'true',
        FAILURE_STRATEGY: 'fail-closed',
        ENABLE_FUNCTION_FALLBACK: 'false',
        MAX_KEY_LENGTH: '256',
      }),
    ),
  ],
})
export class SecurityFocusedModule {}

/**
 * Example 10: Multi-tenant configuration with dynamic prefixes
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const tenantId = configService.get('TENANT_ID', 'default');
        
        return createProductionConfiguration({
          REDIS_HOST: configService.get('REDIS_HOST'),
          REDIS_PORT: configService.get('REDIS_PORT'),
          REDIS_PASSWORD: configService.get('REDIS_PASSWORD'),
          REDIS_KEY_PREFIX: `throttle:${tenantId}`,
          REDIS_TLS: 'true',
        });
      },
      inject: [ConfigService],
    }),
  ],
})
export class MultiTenantModule {}

// =============================================================================
// CONFIGURATION VALIDATION EXAMPLES
// =============================================================================

/**
 * Example 11: Configuration validation and logging
 */
export async function validateAndLogConfiguration() {
  // Create configuration
  const config = createProductionConfiguration({
    REDIS_HOST: 'redis.example.com',
    REDIS_PASSWORD: 'secret123',
    REDIS_TLS: 'true',
  });
  
  // Validate for production readiness
  const validation = validateProductionReadiness(config);
  
  if (!validation.isReady) {
    console.error('❌ Configuration is not production ready:');
    validation.issues.forEach(issue => console.error(`  • ${issue}`));
  }
  
  if (validation.recommendations.length > 0) {
    console.warn('⚠️  Configuration recommendations:');
    validation.recommendations.forEach(rec => console.warn(`  • ${rec}`));
  }
  
  // Log configuration summary
  console.log(getConfigurationSummary(config));
}

// =============================================================================
// MIGRATION EXAMPLES
// =============================================================================

/**
 * Example 12: Migrating from legacy configuration
 */
export function migrateLegacyConfigurationExample() {
  // Legacy configuration format
  const legacyConfig = {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'secret',
      db: 0,
      keyPrefix: 'throttle',
    },
    failureStrategy: 'fail-open',
    enableDebugLogging: true,
    maxWindowSize: 1000,
    enableRedisFunctions: true,
  };
  
  // Migrate to new format
  const newConfig = migrateLegacyConfiguration(legacyConfig);
  
  console.log('Migrated configuration:', getConfigurationSummary(newConfig));
  
  return newConfig;
}

/**
 * Example 13: Configuration with custom validation
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const config = createProductionConfiguration({
          REDIS_HOST: configService.get('REDIS_HOST'),
          REDIS_PORT: configService.get('REDIS_PORT'),
          REDIS_PASSWORD: configService.get('REDIS_PASSWORD'),
        });
        
        // Custom validation
        const validation = validateProductionReadiness(config);
        if (!validation.isReady) {
          throw new Error(`Invalid throttler configuration: ${validation.issues.join(', ')}`);
        }
        
        // Log warnings
        if (validation.recommendations.length > 0) {
          console.warn('Throttler configuration recommendations:', validation.recommendations);
        }
        
        return config;
      },
      inject: [ConfigService],
    }),
  ],
})
export class ValidatedConfigModule {}

// =============================================================================
// DOCKER AND KUBERNETES EXAMPLES
// =============================================================================

/**
 * Example 14: Docker Compose configuration
 * 
 * docker-compose.yml:
 * ```yaml
 * version: '3.8'
 * services:
 *   app:
 *     build: .
 *     environment:
 *       - NODE_ENV=production
 *       - REDIS_HOST=redis
 *       - REDIS_PORT=6379
 *       - REDIS_PASSWORD=secret123
 *       - FAILURE_STRATEGY=fail-closed
 *       - ENABLE_DEBUG_LOGGING=false
 *       - MAX_WINDOW_SIZE=5000
 *     depends_on:
 *       - redis
 *   
 *   redis:
 *     image: redis:7-alpine
 *     command: redis-server --requirepass secret123
 * ```
 */

/**
 * Example 15: Kubernetes ConfigMap configuration
 * 
 * configmap.yaml:
 * ```yaml
 * apiVersion: v1
 * kind: ConfigMap
 * metadata:
 *   name: throttler-config
 * data:
 *   REDIS_HOST: "redis-service"
 *   REDIS_PORT: "6379"
 *   REDIS_DB: "0"
 *   REDIS_KEY_PREFIX: "throttle:k8s"
 *   FAILURE_STRATEGY: "fail-closed"
 *   ENABLE_DEBUG_LOGGING: "false"
 *   LOG_LEVEL: "warn"
 *   MAX_WINDOW_SIZE: "5000"
 *   ENABLE_REDIS_FUNCTIONS: "true"
 * ```
 * 
 * deployment.yaml:
 * ```yaml
 * apiVersion: apps/v1
 * kind: Deployment
 * metadata:
 *   name: app
 * spec:
 *   template:
 *     spec:
 *       containers:
 *       - name: app
 *         image: myapp:latest
 *         envFrom:
 *         - configMapRef:
 *             name: throttler-config
 *         env:
 *         - name: REDIS_PASSWORD
 *           valueFrom:
 *             secretKeyRef:
 *               name: redis-secret
 *               key: password
 * ```
 */

// =============================================================================
// MONITORING AND HEALTH CHECK EXAMPLES
// =============================================================================

/**
 * Example 16: Configuration with health checks enabled
 */
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createProductionConfiguration({
        REDIS_HOST: 'redis.example.com',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        ENABLE_HEALTH_CHECKS: 'true',
        ENABLE_METRICS: 'true',
        LOG_LEVEL: 'info',
      }),
    ),
  ],
})
export class MonitoredModule {}

/**
 * Example 17: Custom configuration class
 */
export class CustomThrottlerConfigService {
  createConfiguration(): any {
    const environment = process.env.NODE_ENV || 'development';
    
    const baseConfig = {
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      REDIS_KEY_PREFIX: `myapp:${environment}`,
    };
    
    switch (environment) {
      case 'production':
        return createProductionConfiguration({
          ...baseConfig,
          REDIS_PASSWORD: process.env.REDIS_PASSWORD,
          REDIS_TLS: 'true',
          FAILURE_STRATEGY: 'fail-closed',
        });
        
      case 'test':
        return createTestingConfiguration({
          ...baseConfig,
          REDIS_DB: '15',
        });
        
      default:
        return createDevelopmentConfiguration(baseConfig);
    }
  }
}

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRootAsync({
      useFactory: (configService: CustomThrottlerConfigService) => {
        return configService.createConfiguration();
      },
      providers: [CustomThrottlerConfigService],
      inject: [CustomThrottlerConfigService],
    }),
  ],
  providers: [CustomThrottlerConfigService],
})
export class CustomConfigServiceModule {}