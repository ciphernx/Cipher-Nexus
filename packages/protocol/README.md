# Cipher Nexus Protocol Package

安全多方计算协议实现,支持多种计算类型和安全特性。

## 功能特性

- 支持多种计算类型(SUM, AVERAGE, MAX, MIN, MEDIAN等)
- 批处理消息优化
- 安全性保护(盲化、门限方案)
- 审计日志
- 错误恢复机制

## 安装

```bash
npm install @ciphernx/protocol
```

## API 文档

### MPCProtocol

主要的协议实现类,提供以下功能:

#### 初始化和会话管理

```typescript
// 创建协议实例
const protocol = new MPCProtocol();

// 初始化协议
await protocol.initialize();

// 启动协议
await protocol.start();

// 创建会话
const session = await protocol.createSession(participants);

// 加入会话
await protocol.joinSession(sessionId);

// 离开会话
await protocol.leaveSession(sessionId);
```

#### 计算操作

```typescript
// 设置本地值
protocol.setLocalValue(value: Buffer);

// 开始计算
await protocol.startComputation(MPCComputationType.SUM);

// 检查计算是否完成
const isComplete = protocol.isComplete();

// 获取计算结果
const result = protocol.getResult();
```

#### 消息处理

```typescript
// 注册消息处理器
protocol.onMessage(async (message: Message) => {
  // 处理接收到的消息
});

// 设置批处理参数
protocol.setBatchParameters(batchSize: number, batchTimeout: number);
```

### 计算类型

支持以下计算类型:

- `MPCComputationType.SUM`: 计算和
- `MPCComputationType.AVERAGE`: 计算平均值
- `MPCComputationType.MAX`: 计算最大值
- `MPCComputationType.MIN`: 计算最小值
- `MPCComputationType.MEDIAN`: 计算中位数
- `MPCComputationType.VARIANCE`: 计算方差
- `MPCComputationType.MODE`: 计算众数
- `MPCComputationType.STD_DEV`: 计算标准差
- `MPCComputationType.QUARTILE`: 计算四分位数
- `MPCComputationType.RANGE`: 计算范围

## 使用示例

### 基本使用

```typescript
import { MPCProtocol, MPCComputationType } from '@ciphernx/protocol';
import { Buffer } from 'buffer';

// 创建参与者
const participants = [
  { id: 'participant1', publicKey: Buffer.from('key1') },
  { id: 'participant2', publicKey: Buffer.from('key2') },
  { id: 'participant3', publicKey: Buffer.from('key3') }
];

// 创建协议实例
const protocol = new MPCProtocol();

// 初始化和启动
await protocol.initialize();
await protocol.start();

// 创建会话
const session = await protocol.createSession(participants);

// 设置消息处理器
protocol.onMessage(async (message) => {
  // 处理消息...
});

// 设置本地值
protocol.setLocalValue(Buffer.from([10]));

// 开始计算
await protocol.startComputation(MPCComputationType.SUM);

// 等待计算完成
while (!protocol.isComplete()) {
  await new Promise(resolve => setTimeout(resolve, 100));
}

// 获取结果
const result = protocol.getResult();
console.log('计算结果:', result?.readUInt8(0));
```

### 高级特性

```typescript
// 启用批处理优化
protocol.setBatchParameters(100, 50); // batchSize = 100, timeout = 50ms

// 使用审计日志
protocol.onMessage(async (message) => {
  // 日志会自动记录关键事件
});

// 错误恢复
protocol.onMessage(async (message) => {
  try {
    // 处理消息...
  } catch (error) {
    // 协议会自动尝试恢复
    console.error('发生错误:', error);
  }
});
```

## 部署指南

### 系统要求

- Node.js >= 14.0.0
- TypeScript >= 4.0.0

### 安装步骤

1. 安装依赖:
```bash
npm install @ciphernx/protocol
```

2. 配置TypeScript:
```json
{
  "compilerOptions": {
    "target": "es2018",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

3. 导入和使用:
```typescript
import { MPCProtocol } from '@ciphernx/protocol';
```

### 生产环境配置

1. 环境变量:
```bash
NODE_ENV=production
LOG_LEVEL=info
BATCH_SIZE=100
BATCH_TIMEOUT=50
```

2. 日志配置:
```typescript
const protocol = new MPCProtocol();
protocol.setLogLevel('info'); // 'debug' | 'info' | 'warn' | 'error'
```

3. 性能优化:
- 调整批处理参数以适应网络条件
- 监控内存使用
- 使用负载均衡器分发请求

### 安全建议

1. 网络安全:
- 使用TLS加密通信
- 实施访问控制
- 监控异常活动

2. 密钥管理:
- 安全存储密钥
- 定期轮换密钥
- 使用硬件安全模块(HSM)

3. 审计:
- 启用审计日志
- 定期审查日志
- 设置告警机制

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License 