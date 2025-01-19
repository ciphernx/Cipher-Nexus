# 使用示例

## 基本用法

### 初始化协议

```typescript
import { MPCProtocol, Participant } from '@ciphernx/protocol';

// 创建协议实例
const protocol = new MPCProtocol();

// 初始化协议
await protocol.initialize();

// 启动协议
await protocol.start();
```

### 创建会话

```typescript
// 创建参与者
const participant1 = {
  id: 'p1',
  publicKey: Buffer.from('...') // 公钥数据
};

const participant2 = {
  id: 'p2', 
  publicKey: Buffer.from('...') // 公钥数据
};

// 创建会话
const session = await protocol.createSession([participant1, participant2]);
console.log('Created session:', session.id);
```

### 执行计算

```typescript
import { MPCComputationType } from '@ciphernx/protocol';

// 设置本地值
const value = Buffer.from([10]); // 要计算的值
protocol.setLocalValue(value);

// 开始计算
await protocol.startComputation(MPCComputationType.SUM);

// 等待计算完成
while (!protocol.isComplete()) {
  await new Promise(resolve => setTimeout(resolve, 100));
}

// 获取结果
const result = protocol.getResult();
console.log('Computation result:', result);
```

## 高级用法

### 批处理优化

```typescript
// 设置批处理参数
protocol.setBatchParameters(100, 50); // 批大小为100,超时50ms

// 注册消息处理器
protocol.onMessage(async (message) => {
  console.log('Received message:', message.type);
});
```

### 错误处理

```typescript
import { ProtocolErrorType } from '@ciphernx/protocol';

try {
  await protocol.startComputation(MPCComputationType.AVERAGE);
} catch (error) {
  switch (error.type) {
    case ProtocolErrorType.INVALID_STATE:
      console.error('Invalid protocol state');
      break;
    case ProtocolErrorType.TIMEOUT:
      console.error('Computation timed out');
      break;
    case ProtocolErrorType.VERIFICATION_FAILED:
      console.error('Verification failed');
      break;
    default:
      console.error('Unknown error:', error);
  }
}
```

### 会话管理

```typescript
// 加入已存在的会话
await protocol.joinSession('session-123');

// 执行计算...

// 离开会话
await protocol.leaveSession('session-123');
```

### 审计日志

```typescript
// 获取审计日志
const logs = protocol.getAuditLogs();
logs.forEach(log => {
  console.log(`[${log.timestamp}] ${log.event} - Participant: ${log.participantId}`);
});
```

## 完整示例

### 求和计算

```typescript
import { 
  MPCProtocol, 
  Participant,
  MPCComputationType,
  ProtocolErrorType 
} from '@ciphernx/protocol';

async function sumExample() {
  try {
    // 初始化
    const protocol = new MPCProtocol();
    await protocol.initialize();
    await protocol.start();

    // 创建参与者
    const participants = [
      { id: 'p1', publicKey: Buffer.from('...') },
      { id: 'p2', publicKey: Buffer.from('...') },
      { id: 'p3', publicKey: Buffer.from('...') }
    ];

    // 创建会话
    const session = await protocol.createSession(participants);
    console.log('Created session:', session.id);

    // 设置本地值
    const value = Buffer.from([5]);
    protocol.setLocalValue(value);

    // 注册消息处理器
    protocol.onMessage(async (message) => {
      console.log('Processing message:', message.type);
    });

    // 开始计算
    await protocol.startComputation(MPCComputationType.SUM);

    // 等待结果
    while (!protocol.isComplete()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 获取结果
    const result = protocol.getResult();
    console.log('Sum result:', result);

    // 获取审计日志
    const logs = protocol.getAuditLogs();
    console.log('Audit logs:', logs);

    // 清理
    await protocol.stop();

  } catch (error) {
    console.error('Error:', error);
  }
}

// 运行示例
sumExample().catch(console.error);
```

### 平均值计算

```typescript
async function averageExample() {
  const protocol = new MPCProtocol();
  await protocol.initialize();
  await protocol.start();

  // 创建会话
  const session = await protocol.createSession([
    { id: 'p1', publicKey: Buffer.from('...') },
    { id: 'p2', publicKey: Buffer.from('...') }
  ]);

  // 设置本地值
  protocol.setLocalValue(Buffer.from([10]));

  // 开始计算平均值
  await protocol.startComputation(MPCComputationType.AVERAGE);

  // 等待结果
  while (!protocol.isComplete()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const result = protocol.getResult();
  console.log('Average result:', result);

  await protocol.stop();
}
```

### 最大值计算

```typescript
async function maxExample() {
  const protocol = new MPCProtocol();
  await protocol.initialize();
  await protocol.start();

  // 创建会话
  const session = await protocol.createSession([
    { id: 'p1', publicKey: Buffer.from('...') },
    { id: 'p2', publicKey: Buffer.from('...') }
  ]);

  // 设置本地值
  protocol.setLocalValue(Buffer.from([15]));

  // 开始计算最大值
  await protocol.startComputation(MPCComputationType.MAX);

  // 等待结果
  while (!protocol.isComplete()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const result = protocol.getResult();
  console.log('Max result:', result);

  await protocol.stop();
}
```

## 最佳实践

1. 错误处理
- 始终使用 try-catch 包装异步操作
- 正确处理所有错误类型
- 实现错误恢复机制

2. 性能优化
- 根据实际需求调整批处理参数
- 避免频繁创建/销毁会话
- 复用协议实例

3. 安全性
- 使用安全的密钥生成方法
- 定期轮换会话
- 验证所有输入数据
- 监控审计日志

4. 资源管理
- 及时清理不再使用的会话
- 正确调用 stop() 方法释放资源
- 避免内存泄漏 