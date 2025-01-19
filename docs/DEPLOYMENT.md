# Cipher Nexus 部署指南

## 环境要求

### 硬件要求
- CPU: 8核心以上
- 内存: 16GB以上
- 存储: 100GB以上SSD
- 网络: 100Mbps以上带宽

### 软件要求
- 操作系统: Ubuntu 20.04 LTS 或更高版本
- Node.js: v16.x 或更高版本
- Docker: 20.10.x 或更高版本
- Docker Compose: v2.x 或更高版本

### TEE环境要求
- Intel SGX 支持的CPU
- SGX驱动程序已安装
- Intel SGX SDK已安装
- Intel SGX PSW已安装

## 安装步骤

### 1. 系统准备

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装基础工具
sudo apt-get install -y git curl wget build-essential
```

### 2. 安装Node.js

```bash
# 使用nvm安装Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 16
nvm use 16
```

### 3. 安装Docker

```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.5.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. 安装Intel SGX

```bash
# 安装SGX驱动
wget https://download.01.org/intel-sgx/sgx-linux/2.15/distro/ubuntu20.04-server/sgx_linux_x64_driver_1.41.bin
chmod +x sgx_linux_x64_driver_1.41.bin
sudo ./sgx_linux_x64_driver_1.41.bin

# 安装SGX SDK
wget https://download.01.org/intel-sgx/sgx-linux/2.15/distro/ubuntu20.04-server/sgx_linux_x64_sdk_2.15.100.3.bin
chmod +x sgx_linux_x64_sdk_2.15.100.3.bin
sudo ./sgx_linux_x64_sdk_2.15.100.3.bin

# 安装SGX PSW
sudo apt-get install libsgx-launch libsgx-urts libsgx-epid libsgx-quote-ex
```

### 5. 克隆项目

```bash
git clone https://github.com/your-org/cipher-nexus.git
cd cipher-nexus
```

### 6. 安装依赖

```bash
# 安装项目依赖
npm install

# 构建项目
npm run build
```

### 7. 配置环境变量

创建 `.env` 文件：

```env
# 网络配置
PORT=3000
HOST=0.0.0.0

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=cipher
DB_PASS=your-password
DB_NAME=cipher_nexus

# TEE配置
SGX_SPID=your-spid
SGX_QUOTE_TYPE=0
SGX_KEY_ID=your-key-id

# 代币配置
TOKEN_SYMBOL=CNX
TOKEN_NAME="Cipher Nexus Token"
TOKEN_DECIMALS=18
TOKEN_INITIAL_SUPPLY=1000000000

# 安全配置
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

### 8. 初始化数据库

```bash
# 创建数据库
npm run db:create

# 运行迁移
npm run db:migrate

# 初始化数据
npm run db:seed
```

### 9. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm run start
```

## 部署架构

### 单节点部署
```
+-------------+     +-------------+     +-------------+
|   Nginx     | --> |   Node.js   | --> |  Database   |
+-------------+     +-------------+     +-------------+
```

### 集群部署
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

## 监控配置

### 1. 系统监控

```bash
# 安装Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# 安装Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

### 2. 日志管理

```bash
# 安装ELK Stack
docker-compose -f elk-stack.yml up -d
```

### 3. 告警配置

```bash
# 配置Alertmanager
docker run -d \
  --name alertmanager \
  -p 9093:9093 \
  -v /path/to/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
  prom/alertmanager
```

## 安全配置

### 1. 防火墙设置

```bash
# 配置UFW
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. SSL配置

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

### 3. 权限设置

```bash
# 设置文件权限
sudo chown -R node:node /path/to/app
sudo chmod -R 755 /path/to/app
```

## 维护指南

### 1. 备份

```bash
# 备份数据库
npm run db:backup

# 备份配置
tar -czf config-backup.tar.gz config/
```

### 2. 更新

```bash
# 更新代码
git pull origin main

# 更新依赖
npm install

# 重新构建
npm run build

# 重启服务
npm run restart
```

### 3. 回滚

```bash
# 回滚代码
git reset --hard <commit-hash>

# 回滚数据库
npm run db:rollback

# 重启服务
npm run restart
```

## 故障排除

### 1. 日志查看

```bash
# 查看应用日志
npm run logs

# 查看系统日志
sudo journalctl -u cipher-nexus
```

### 2. 健康检查

```bash
# 检查服务状态
npm run health-check

# 检查数据库连接
npm run db:check
```

### 3. 常见问题

- 服务无法启动
  - 检查端口占用
  - 检查环境变量
  - 检查日志输出

- 性能问题
  - 检查系统资源
  - 检查数据库索引
  - 检查缓存配置

- 安全问题
  - 检查防火墙规则
  - 检查访问日志
  - 检查权限设置 