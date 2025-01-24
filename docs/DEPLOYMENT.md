# Cipher Nexus Deployment Guide

## Environment Requirements

### Hardware Requirements
- CPU: 8+ cores
- Memory: 16GB+ RAM
- Storage: 100GB+ SSD
- Network: 100Mbps+ bandwidth

### Software Requirements
- Operating System: Ubuntu 20.04 LTS or higher
- Node.js: v16.x or higher
- Docker: 20.10.x or higher
- Docker Compose: v2.x or higher

### TEE Environment Requirements
- Intel SGX supported CPU
- SGX driver installed
- Intel SGX SDK installed
- Intel SGX PSW installed

## Installation Steps

### 1. System Preparation

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install basic tools
sudo apt-get install -y git curl wget build-essential
```

### 2. Install Node.js

```bash
# Install Node.js using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 16
nvm use 16
```

### 3. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Install Intel SGX

```bash
# Install SGX driver
wget https://download.01.org/intel-sgx/sgx-linux/2.15/distro/ubuntu20.04-server/sgx_linux_x64_driver_1.41.bin
chmod +x sgx_linux_x64_driver_1.41.bin
sudo ./sgx_linux_x64_driver_1.41.bin

# Install SGX SDK
wget https://download.01.org/intel-sgx/sgx-linux/2.15/distro/ubuntu20.04-server/sgx_linux_x64_sdk_2.15.100.3.bin
chmod +x sgx_linux_x64_sdk_2.15.100.3.bin
sudo ./sgx_linux_x64_sdk_2.15.100.3.bin

# Install SGX PSW
sudo apt-get install libsgx-launch libsgx-urts libsgx-epid libsgx-quote-ex
```

### 5. Clone Project

```bash
git clone https://github.com/your-org/cipher-nexus.git
cd cipher-nexus
```

### 6. Install Dependencies

```bash
# Install project dependencies
npm install

# Build project
npm run build
```

### 7. Configure Environment Variables

Create `.env` file:

```env
# Network Configuration
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=cipher
DB_PASS=your-password
DB_NAME=cipher_nexus

# TEE Configuration
SGX_SPID=your-spid
SGX_QUOTE_TYPE=0
SGX_KEY_ID=your-key-id

# Token Configuration
TOKEN_SYMBOL=CNX
TOKEN_NAME="Cipher Nexus Token"
TOKEN_DECIMALS=18
TOKEN_INITIAL_SUPPLY=1000000000

# Security Configuration
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

### 8. Initialize Database

```bash
# Create database
npm run db:create

# Run migrations
npm run db:migrate

# Initialize data
npm run db:seed
```

### 9. Start Services

```bash
# Development environment
npm run dev

# Production environment
npm run start
```

## Deployment Architecture

### Single Node Deployment
```
+-------------+     +-------------+     +-------------+
|   Nginx     | --> |   Node.js   | --> |  Database   |
+-------------+     +-------------+     +-------------+
```

### Cluster Deployment
```
                    +-------------+
                    |   HAProxy   |
                    +-------------+
                          |
            +------------+------------+
            |                        |
    +-------------+          +-------------+
    |   Node.js   |          |   Node.js   |
    +-------------+          +-------------+
            |                        |
    +-------------+          +-------------+
    |  Database   |  <-----> |  Database   |
    +-------------+          +-------------+
```

## Monitoring Configuration

### 1. System Monitoring

```bash
# Install Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Install Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

### 2. Log Management

```bash
# Install ELK Stack
docker-compose -f elk-stack.yml up -d
```

### 3. Alert Configuration

```bash
# Configure Alertmanager
docker run -d \
  --name alertmanager \
  -p 9093:9093 \
  -v /path/to/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
  prom/alertmanager
```

## Security Configuration

### 1. Firewall Settings

```bash
# Configure UFW
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. SSL Configuration

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

### 3. Permission Settings

```bash
# Set file permissions
sudo chown -R node:node /path/to/app
sudo chmod -R 755 /path/to/app
```

## Maintenance Guide

### 1. Backup

```bash
# Backup database
npm run db:backup

# Backup configuration
tar -czf config-backup.tar.gz config/
```

### 2. Update

```bash
# Update code
git pull origin main

# Update dependencies
npm install

# Rebuild project
npm run build

# Restart services
npm run restart
```

### 3. Rollback

```bash
# Rollback code
git reset --hard <commit-hash>

# Rollback database
npm run db:rollback

# Restart services
npm run restart
```

## Troubleshooting

### 1. Log Inspection

```bash
# Check application logs
npm run logs

# Check system logs
sudo journalctl -u cipher-nexus
```

### 2. Health Check

```bash
# Check service status
npm run health-check

# Check database connection
npm run db:check
```

### 3. Common Issues

- Service startup failure
  - Check port occupation
  - Check environment variables
  - Check log output

- Performance issues
  - Check system resources
  - Check database indexing
  - Check cache configuration

- Security issues
  - Check firewall rules
  - Check access logs
  - Check permission settings 