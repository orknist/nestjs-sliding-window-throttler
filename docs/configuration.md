# Configuration Guide

This guide covers the simplified configuration options for the `nestjs-sliding-window-throttler` package, focusing on essential settings for production use.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Configuration Methods](#configuration-methods)
- [Configuration Helpers](#configuration-helpers)
- [Validation](#validation)
- [Security Considerations](#security-considerations)
- [Performance Tuning](#performance-tuning)
- [Production Configuration](#production-configuration)
- [Docker and Kubernetes](#docker-and-kubernetes)
- [Examples](#examples)

## Quick Start

The simplest way to configure the throttler is using environment variables:

```typescript
import { Module } from '@nestjs/common';
import { SlidingWindowThrottlerModule, createConfig } from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    // Automatically reads from process.env
    SlidingWindowThrottlerModule.forRoot(createConfig()),
  ],
})
export class AppModule {}
```

Set these environment variables:

```bash
# Required
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional
FAILURE_STRATEGY=fail-open
ENABLE_DEBUG_LOGGING=false
```

## Environment Variables

### Required Configuration

| Variable | Type | Description |
|----------|------|-------------|
| `REDIS_HOST` | string | Redis server hostname or IP address |
| `REDIS_PORT` | number | Redis server port (typically 6379) |

### Optional Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_PASSWORD` | string | - | Redis authentication password |
| `REDIS_DB` | number | `0` | Redis database number (0-15) |
| `REDIS_KEY_PREFIX` | string | `throttle` | Prefix for all Redis keys |
| `FAILURE_STRATEGY` | enum | `fail-open` | `fail-open` or `fail-closed` |
| `ENABLE_DEBUG_LOGGING` | boolean | `false` | Enable debug logging |
| `MAX_WINDOW_SIZE` | number | `1000` | Maximum entries in sliding window |
| `ENABLE_REDIS_FUNCTIONS` | boolean | `true` | Use Redis Functions when available |

## Configuration Methods

### 1. Environment Variables (Recommended)

```typescript
import { createConfig } from 'nestjs-sliding-window-throttler';

// Reads all configuration from process.env
SlidingWindowThrottlerModule.forRoot(createConfig())
```

### 2. Direct Configuration

```typescript
import { FailureStrategy } from 'nestjs-sliding-window-throttler';

SlidingWindowThrottlerModule.forRoot({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'optional-password',
    db: 0,
    keyPrefix: 'throttle',
  },
  failureStrategy: FailureStrategy.FAIL_OPEN,
  enableDebugLogging: false,
  maxWindowSize: 1000,
  enableRedisFunctions: true,
})
```

### 3. Async Configuration

```typescript
SlidingWindowThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB', 0),
      keyPrefix: configService.get('REDIS_KEY_PREFIX', 'throttle'),
    },
    failureStrategy: configService.get('FAILURE_STRATEGY') === 'fail-closed' 
      ? FailureStrategy.FAIL_CLOSED 
      : FailureStrategy.FAIL_OPEN,
    enableDebugLogging: configService.get('NODE_ENV') === 'development',
    maxWindowSize: configService.get('MAX_WINDOW_SIZE', 1000),
    enableRedisFunctions: configService.get('ENABLE_REDIS_FUNCTIONS', 'true') === 'true',
  }),
  inject: [ConfigService],
})
```

## Configuration Validation

### Automatic Validation

The `createConfig()` function automatically validates configuration and provides clear error messages:

```typescript
import { createConfig } from 'nestjs-sliding-window-throttler';

try {
  const config = createConfig();
  // Configuration is valid
} catch (error) {
  console.error('Configuration error:', error.message);
  // e.g., "REDIS_HOST is required"
}
```

### Production Validation

```typescript
import { createConfig, validateConfig, getConfigSummary } from 'nestjs-sliding-window-throttler';

const config = createConfig();
const { isValid, warnings } = validateConfig(config);

if (warnings.length > 0) {
  console.warn('Configuration warnings:', warnings);
}

console.log('Configuration summary:');
console.log(getConfigSummary(config));
```

## Validation

### Automatic Validation

All configurations are automatically validated at startup. Invalid configurations will cause the application to fail fast with detailed error messages:

```
❌ Configuration validation failed during application startup
   Missing or invalid environment variables detected.
   Application cannot start with invalid configuration.

   redis.host: REDIS_HOST is required and must be a string
   redis.port: REDIS_PORT must be a valid number between 1 and 65535

💡 Please check your .env file and ensure all required variables are set.
```

### Production Readiness Check

```typescript
import { validateProductionReadiness, getConfigurationSummary } from 'nestjs-sliding-window-throttler';

const config = createProductionConfiguration();
const validation = validateProductionReadiness(config);

if (!validation.isReady) {
  console.error('❌ Configuration issues:', validation.issues);
}

if (validation.recommendations.length > 0) {
  console.warn('⚠️  Recommendations:', validation.recommendations);
}

console.log(getConfigurationSummary(config));
```

### Custom Validation

```typescript
SlidingWindowThrottlerModule.forRootAsync({
  useFactory: async (configService: ConfigService) => {
    const config = createProductionConfiguration({
      REDIS_HOST: configService.get('REDIS_HOST'),
    });
    
    // Custom validation
    const validation = validateProductionReadiness(config);
    if (!validation.isReady) {
      throw new Error(`Invalid configuration: ${validation.issues.join(', ')}`);
    }
    
    return config;
  },
  inject: [ConfigService],
})
```

## Security Considerations

### Production Security Checklist

- ✅ Set `REDIS_PASSWORD` for remote Redis connections
- ✅ Enable `REDIS_TLS=true` for remote connections
- ✅ Use `FAILURE_STRATEGY=fail-closed` for security-critical applications
- ✅ Set `ENABLE_DEBUG_LOGGING=false` in production
- ✅ Use strong, unique `REDIS_KEY_PREFIX` values
- ✅ Enable `ENABLE_KEY_SANITIZATION=true`
- ✅ Set appropriate `MAX_KEY_LENGTH` limits

### Example Secure Configuration

```typescript
const secureConfig = createSecurityFocusedConfiguration({
  REDIS_HOST: 'secure-redis.example.com',
  REDIS_PORT: '6380',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD, // From secure storage
  REDIS_TLS: 'true',
  FAILURE_STRATEGY: 'fail-closed',
  ENABLE_DEBUG_LOGGING: 'false',
  MAX_KEY_LENGTH: '256',
});
```

## Performance Tuning

### High-Throughput Applications

```typescript
const highThroughputConfig = createHighThroughputConfiguration({
  MAX_WINDOW_SIZE: '10000',
  CLEANUP_INTERVAL: '5m',
  ENABLE_BATCH_OPERATIONS: 'true',
  REDIS_COMMAND_TIMEOUT: '2000',
});
```

### Memory Optimization

```typescript
const memoryOptimizedConfig = {
  MAX_WINDOW_SIZE: '500',
  CLEANUP_INTERVAL: '30s',
  MAX_KEY_LENGTH: '128',
  ENABLE_KEY_SANITIZATION: 'true',
};
```

### Redis Cluster Optimization

```typescript
const clusterConfig = {
  REDIS_KEY_PREFIX: 'throttle:{hash}', // Use hash tags for cluster
  ENABLE_BATCH_OPERATIONS: 'true',
  REDIS_RETRY_DELAY: '200',
};
```

## Production Configuration

### Production Checklist

Before deploying to production, ensure:

- [ ] **Redis/Valkey Version**: 7.0+ for optimal performance
- [ ] **Failure Strategy**: Set to `fail-closed` for security
- [ ] **Debug Logging**: Disabled (`ENABLE_DEBUG_LOGGING=false`)
- [ ] **TLS**: Enabled for remote Redis connections
- [ ] **Authentication**: Redis password configured
- [ ] **Monitoring**: Health checks and metrics enabled
- [ ] **Backup**: Redis persistence configured
- [ ] **Scaling**: Redis cluster for high availability

### Production Environment Variables

```bash
# Production .env
NODE_ENV=production

# Redis Configuration (Required)
REDIS_HOST=redis.production.com
REDIS_PORT=6380
REDIS_PASSWORD=secure-production-password
REDIS_TLS=true
REDIS_DB=0

# Security Configuration
FAILURE_STRATEGY=fail-closed
ENABLE_KEY_SANITIZATION=true
MAX_KEY_LENGTH=256

# Performance Configuration
MAX_WINDOW_SIZE=5000
CLEANUP_INTERVAL=5m
ENABLE_BATCH_OPERATIONS=true

# Monitoring Configuration
ENABLE_DEBUG_LOGGING=false
LOG_LEVEL=warn
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true

# Redis Functions Configuration
ENABLE_REDIS_FUNCTIONS=true
FUNCTION_LIBRARY_PREFIX=throttler_prod
MIN_REDIS_VERSION=7.0.0
```

### High Availability Configuration

```typescript
// Production module with HA Redis
import { createProductionConfiguration } from 'nestjs-sliding-window-throttler';

@Module({
  imports: [
    SlidingWindowThrottlerModule.forRoot(
      createProductionConfiguration({
        // Primary Redis cluster
        REDIS_HOST: 'redis-cluster.prod.com',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        REDIS_TLS: 'true',
        
        // Security settings
        FAILURE_STRATEGY: 'fail-closed',
        ENABLE_KEY_SANITIZATION: 'true',
        
        // Performance settings
        MAX_WINDOW_SIZE: '10000',
        CLEANUP_INTERVAL: '10m',
        
        // Monitoring
        ENABLE_METRICS: 'true',
        ENABLE_HEALTH_CHECKS: 'true',
      })
    ),
  ],
})
export class ProductionAppModule {}
```

### Load Balancer Configuration

```typescript
// Multi-region configuration
SlidingWindowThrottlerModule.forRootAsync({
  useFactory: () => {
    const region = process.env.AWS_REGION || 'us-east-1';
    
    return createProductionConfiguration({
      REDIS_HOST: `redis-${region}.prod.com`,
      REDIS_KEY_PREFIX: `throttle:${region}`,
      FAILURE_STRATEGY: 'fail-closed',
    });
  },
});
```

## Docker and Kubernetes

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=secure123
      - FAILURE_STRATEGY=fail-closed
      - ENABLE_DEBUG_LOGGING=false
      - MAX_WINDOW_SIZE=5000
      - REDIS_TLS=false
    depends_on:
      - redis
    networks:
      - app-network
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine  # or valkey/valkey:7-alpine
    command: >
      redis-server 
      --requirepass secure123
      --maxmemory 1gb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Kubernetes Deployment

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: throttler-config
  namespace: production
data:
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  REDIS_KEY_PREFIX: "throttle:k8s"
  FAILURE_STRATEGY: "fail-closed"
  ENABLE_DEBUG_LOGGING: "false"
  MAX_WINDOW_SIZE: "5000"
  REDIS_TLS: "true"
  ENABLE_METRICS: "true"
  ENABLE_HEALTH_CHECKS: "true"
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: throttler-secrets
  namespace: production
type: Opaque
data:
  REDIS_PASSWORD: <base64-encoded-password>
```

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: throttler-config
        - secretRef:
            name: throttler-secrets
        livenessProbe:
          httpGet:
            path: /health/throttler
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/throttler
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

#### Redis Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: production
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: production
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine  # or valkey/valkey:7-alpine
        command:
        - redis-server
        - --requirepass
        - $(REDIS_PASSWORD)
        - --maxmemory
        - 2gb
        - --maxmemory-policy
        - allkeys-lru
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: throttler-secrets
              key: REDIS_PASSWORD
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: redis-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### Helm Chart

```yaml
# values.yaml
app:
  name: myapp
  image:
    repository: myapp
    tag: latest
  replicas: 3

throttler:
  redis:
    host: redis-service
    port: 6379
    password: secure123
    tls: true
  config:
    failureStrategy: fail-closed
    maxWindowSize: 5000
    enableMetrics: true
    enableHealthChecks: true

redis:
  enabled: true
  auth:
    enabled: true
    password: secure123
  master:
    persistence:
      enabled: true
      size: 10Gi
  metrics:
    enabled: true
```

### Monitoring and Observability

#### Prometheus Metrics

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: throttler-metrics
  namespace: production
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

#### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Throttler Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(throttler_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Throttled Requests",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(throttler_blocked_requests_total[5m])",
            "legendFormat": "Blocked/sec"
          }
        ]
      },
      {
        "title": "Redis Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "throttler_redis_response_time_seconds",
            "legendFormat": "Response Time"
          }
        ]
      }
    ]
  }
}
```

## Examples

### Environment-Specific Configuration

```typescript
@Module({
  imports: [
    SlidingWindowThrottlerModule.forRootAsync({
      useFactory: () => {
        const env = process.env.NODE_ENV;
        
        switch (env) {
          case 'production':
            return createProductionConfiguration();
          case 'staging':
            return createProductionConfiguration({
              FAILURE_STRATEGY: 'fail-open', // More lenient in staging
              ENABLE_DEBUG_LOGGING: 'true',
            });
          case 'test':
            return createTestingConfiguration();
          default:
            return createDevelopmentConfiguration();
        }
      },
    }),
  ],
})
export class AppModule {}
```

### Multi-Tenant Configuration

```typescript
SlidingWindowThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => {
    const tenantId = configService.get('TENANT_ID');
    
    return createProductionConfiguration({
      REDIS_KEY_PREFIX: `throttle:${tenantId}`,
      REDIS_HOST: configService.get('REDIS_HOST'),
      MAX_WINDOW_SIZE: configService.get('MAX_WINDOW_SIZE', '1000'),
    });
  },
  inject: [ConfigService],
})
```

### Microservices Configuration

```typescript
// API Gateway service
SlidingWindowThrottlerModule.forRoot(
  createProductionConfiguration({
    REDIS_KEY_PREFIX: 'throttle:gateway',
    MAX_WINDOW_SIZE: '10000', // Higher limit for gateway
    FAILURE_STRATEGY: 'fail-closed',
  })
);

// User service
SlidingWindowThrottlerModule.forRoot(
  createProductionConfiguration({
    REDIS_KEY_PREFIX: 'throttle:users',
    MAX_WINDOW_SIZE: '5000',
    FAILURE_STRATEGY: 'fail-open', // More lenient for internal service
  })
);
```

### A/B Testing Configuration

```typescript
SlidingWindowThrottlerModule.forRootAsync({
  useFactory: () => {
    const variant = process.env.AB_TEST_VARIANT;
    
    const baseConfig = createProductionConfiguration();
    
    if (variant === 'strict') {
      return {
        ...baseConfig,
        maxWindowSize: 500, // Stricter limits
      };
    }
    
    return baseConfig;
  },
});
```

## Migration from Legacy Configuration

If you're upgrading from an older version, use the migration helper:

```typescript
import { migrateLegacyConfiguration } from 'nestjs-sliding-window-throttler';

const legacyConfig = {
  redis: { host: 'localhost', port: 6379 },
  failureStrategy: 'fail-open',
  enableDebugLogging: true,
};

const newConfig = migrateLegacyConfiguration(legacyConfig);
```

## Troubleshooting

### Common Issues

1. **Configuration validation failed**: Check that all required environment variables are set
2. **Redis connection failed**: Verify Redis host, port, and credentials
3. **Redis Functions not supported**: Ensure Redis version 7.0+ or disable functions
4. **Performance issues**: Tune `MAX_WINDOW_SIZE` and `CLEANUP_INTERVAL`
5. **Memory issues**: Monitor Redis memory usage and configure limits

### Debug Configuration

Enable debug logging to troubleshoot configuration issues:

```bash
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug
```

### Health Checks

Enable health checks to monitor configuration status:

```bash
ENABLE_HEALTH_CHECKS=true
```

The health check endpoint will report Redis connectivity and configuration status:

```typescript
@Controller('health')
export class HealthController {
  constructor(private readonly storage: SlidingWindowThrottlerStorage) {}
  
  @Get('throttler')
  async checkThrottler() {
    const metrics = await this.storage.getMetrics();
    
    return {
      status: metrics.health.isHealthy ? 'healthy' : 'unhealthy',
      redis: metrics.redis.connectionStatus,
      functions: metrics.redis.functionsLoaded,
      performance: {
        averageResponseTime: metrics.performance.averageResponseTime,
        successRate: metrics.health.successRate,
      },
    };
  }
}
```

### Configuration Validation

```typescript
import { validateConfiguration, getConfigurationSummary } from 'nestjs-sliding-window-throttler';

const config = createProductionConfiguration();
const validation = validateConfiguration(config);

if (!validation.isValid) {
  console.error('❌ Configuration Errors:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  Configuration Warnings:');
  validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

console.log('✅ Configuration Summary:');
console.log(getConfigurationSummary(config));
```