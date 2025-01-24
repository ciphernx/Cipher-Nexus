# Cipher Nexus CI/CD Configuration Guide

## CI/CD Process Overview

### Overall Process
```
Code Commit → Static Check → Unit Test → Build → Integration Test → Deploy → Monitor
```

## Continuous Integration (CI)

### 1. Code Quality Check

#### ESLint Configuration
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "complexity": ["error", 10]
  }
}
```

#### Test Coverage Requirements
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 90,
        "statements": 90
      },
      "./src/core/": {
        "branches": 90,
        "functions": 95,
        "lines": 95
      },
      "./src/protocol/": {
        "branches": 85,
        "functions": 90,
        "lines": 90
      }
    }
  }
}
```

### 2. Build Configuration

#### Module Build Order
```yaml
build:
  order:
    - packages/core
    - packages/protocol
    - packages/api
    - packages/ui
```

#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@core/*": ["./packages/core/src/*"],
      "@protocol/*": ["./packages/protocol/src/*"],
      "@api/*": ["./packages/api/src/*"]
    }
  }
}
```

### 3. Test Configuration

#### Unit Tests
```yaml
test:unit:
  script:
    - npm run test:unit
  coverage:
    - packages/core/coverage
    - packages/protocol/coverage
    - packages/api/coverage
```

#### Integration Tests
```yaml
test:integration:
  script:
    - docker-compose up -d
    - npm run test:integration
  services:
    - docker:dind
```

## Continuous Deployment (CD)

### 1. Environment Configuration

#### Development Environment
```yaml
deploy:dev:
  stage: deploy
  environment:
    name: development
  script:
    - npm run build
    - npm run db:migrate
    - pm2 restart dev-cluster
```

#### Staging Environment
```yaml
deploy:staging:
  stage: deploy
  environment:
    name: staging
  script:
    - npm run build:prod
    - npm run db:migrate
    - docker-compose up -d
```

#### Production Environment
```yaml
deploy:prod:
  stage: deploy
  environment:
    name: production
  script:
    - npm run build:prod
    - npm run db:migrate:prod
    - kubectl apply -f k8s/
  only:
    - master
  when: manual
```

### 2. Deployment Strategies

#### Blue-Green Deployment
```yaml
deploy:blue-green:
  script:
    - kubectl apply -f k8s/deployment-blue.yml
    - kubectl wait --for=condition=available deployment/app-blue
    - kubectl patch service app -p '{"spec":{"selector":{"version":"blue"}}}'
```

#### Canary Deployment
```yaml
deploy:canary:
  script:
    - kubectl apply -f k8s/deployment-canary.yml
    - kubectl scale deployment app-canary --replicas=1
    - sleep 300
    - kubectl scale deployment app-canary --replicas=5
```

### 3. Rollback Strategies

#### Automatic Rollback
```yaml
rollback:auto:
  script:
    - if [ $CI_JOB_STATUS == "failed" ]; then
    -   kubectl rollout undo deployment/app
    - fi
  when: on_failure
```

#### Manual Rollback
```yaml
rollback:manual:
  script:
    - kubectl rollout undo deployment/app --to-revision=$REVISION
  when: manual
```

## GitLab CI Configuration

### 1. Main Configuration File

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""

include:
  - local: .gitlab/ci/*.yml

cache:
  paths:
    - node_modules/
    - packages/*/node_modules/

lint:
  stage: lint
  script:
    - npm run lint
    - npm run type-check

test:
  stage: test
  script:
    - npm run test:coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - npm run deploy
  environment:
    name: production
  only:
    - master
```

### 2. Module Configuration

#### Core Module
```yaml
# .gitlab/ci/core.yml
build:core:
  stage: build
  script:
    - cd packages/core
    - npm run build
  artifacts:
    paths:
      - packages/core/dist/

test:core:
  stage: test
  script:
    - cd packages/core
    - npm run test:coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
```

#### Protocol Module
```yaml
# .gitlab/ci/protocol.yml
build:protocol:
  stage: build
  script:
    - cd packages/protocol
    - npm run build
  artifacts:
    paths:
      - packages/protocol/dist/

test:protocol:
  stage: test
  script:
    - cd packages/protocol
    - npm run test:coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
```

## Jenkins Configuration

### 1. Jenkinsfile

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'node:16'
            args '-v /var/run/docker.sock:/var/run/docker.sock'
        }
    }
    
    environment {
        NPM_CONFIG_CACHE = "${WORKSPACE}/.npm"
        DOCKER_BUILDKIT = '1'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('Lint') {
            steps {
                sh 'npm run lint'
                sh 'npm run type-check'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm run test:coverage'
            }
            post {
                always {
                    junit 'coverage/junit.xml'
                    publishCoverage adapters: [coberturaAdapter('coverage/cobertura-coverage.xml')]
                }
            }
        }
        
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        
        stage('Deploy') {
            when {
                branch 'master'
            }
            steps {
                sh 'npm run deploy'
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
    }
}
```

### 2. Build Configuration

#### Docker Build
```groovy
// docker-build.groovy
def buildDocker() {
    docker.build("cipher-nexus:${env.BUILD_NUMBER}")
}

def pushDocker() {
    docker.withRegistry('https://registry.example.com', 'docker-credentials') {
        def image = docker.image("cipher-nexus:${env.BUILD_NUMBER}")
        image.push()
        image.push('latest')
    }
}
```

#### Kubernetes Deployment
```groovy
// k8s-deploy.groovy
def deploy() {
    withKubeConfig([credentialsId: 'k8s-credentials']) {
        sh """
            kubectl apply -f k8s/
            kubectl set image deployment/app app=cipher-nexus:${env.BUILD_NUMBER}
            kubectl rollout status deployment/app
        """
    }
}
```

## Monitoring and Alerting

### 1. Performance Monitoring

#### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cipher-nexus'
    static_configs:
      - targets: ['localhost:3000']
```

#### Grafana Dashboard
```json
{
  "dashboard": {
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "http_request_duration_seconds"
          }
        ]
      }
    ]
  }
}
```

### 2. Error Alerting

#### AlertManager Configuration
```yaml
route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 1h
  receiver: 'team-alerts'

receivers:
  - name: 'team-alerts'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
```

## Automation Scripts

### 1. Build Script

```bash
#!/bin/bash
# build.sh

# Build core module
cd packages/core
npm run build
if [ $? -ne 0 ]; then
    echo "Core build failed"
    exit 1
fi

# Build protocol module
cd ../protocol
npm run build
if [ $? -ne 0 ]; then
    echo "Protocol build failed"
    exit 1
fi

# Build API module
cd ../api
npm run build
if [ $? -ne 0 ]; then
    echo "API build failed"
    exit 1
fi
```

### 2. Deploy Script

```bash
#!/bin/bash
# deploy.sh

# Check environment
if [ -z "$ENVIRONMENT" ]; then
    echo "Environment not set"
    exit 1
fi

# Execute database migration
npm run db:migrate

# Deploy application
case "$ENVIRONMENT" in
    "development")
        pm2 restart dev-cluster
        ;;
    "staging")
        docker-compose up -d
        ;;
    "production")
        kubectl apply -f k8s/
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac
```

### 3. Monitor Script

```bash
#!/bin/bash
# monitor.sh

# Check service health status
check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
    if [ $response -ne 200 ]; then
        echo "Service is unhealthy"
        exit 1
    fi
}

# Check resource usage
check_resources() {
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
    mem_usage=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
    
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo "High CPU usage: $cpu_usage%"
    fi
    
    if (( $(echo "$mem_usage > 80" | bc -l) )); then
        echo "High memory usage: $mem_usage%"
    fi
}

# Main loop
while true; do
    check_health
    check_resources
    sleep 60
done
``` 