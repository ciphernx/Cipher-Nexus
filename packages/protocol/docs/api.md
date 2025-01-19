# API 文档

## 类

### MPCProtocol

安全多方计算协议的主要实现类。

#### 构造函数

```typescript
constructor()
```

创建新的MPCProtocol实例。

#### 方法

##### 初始化和会话管理

```typescript
async initialize(): Promise<void>
```
初始化协议,必须在使用其他方法前调用。

```typescript
async start(): Promise<void>
```
启动协议,开始处理消息。

```typescript
async stop(): Promise<void>
```
停止协议,清理资源。

```typescript
async createSession(participants: Participant[]): Promise<Session>
```
创建新的计算会话。
- `participants`: 参与计算的成员列表
- 返回: 创建的会话对象

```typescript
async joinSession(sessionId: string): Promise<void>
```
加入已存在的会话。
- `sessionId`: 要加入的会话ID

```typescript
async leaveSession(sessionId: string): Promise<void>
```
离开当前会话。
- `sessionId`: 要离开的会话ID

##### 计算操作

```typescript
setLocalValue(value: Buffer): void
```
设置本地计算值。
- `value`: 要参与计算的本地值

```typescript
async startComputation(type: MPCComputationType): Promise<void>
```
开始指定类型的计算。
- `type`: 计算类型

```typescript
isComplete(): boolean
```
检查计算是否完成。
- 返回: 如果计算完成则为true

```typescript
getResult(): Buffer | undefined
```
获取计算结果。
- 返回: 计算结果,如果未完成则为undefined

##### 消息处理

```typescript
onMessage(handler: (message: Message) => Promise<void>): void
```
注册消息处理器。
- `handler`: 处理接收到消息的回调函数

```typescript
setBatchParameters(batchSize: number, batchTimeout: number): void
```
设置消息批处理参数。
- `batchSize`: 每批处理的消息数量
- `batchTimeout`: 批处理超时时间(毫秒)

### Message

表示协议中传输的消息。

```typescript
interface Message {
  type: string;           // 消息类型
  sender: string;         // 发送者ID
  receiver: string;       // 接收者ID
  content: Buffer;        // 消息内容
  timestamp: Date;        // 时间戳
}
```

### Session

表示一个计算会话。

```typescript
interface Session {
  id: string;                    // 会话ID
  participants: Participant[];    // 参与者列表
  state: any;                    // 会话状态
  startTime: Date;               // 开始时间
  endTime?: Date;               // 结束时间
}
```

### Participant

表示参与计算的成员。

```typescript
interface Participant {
  id: string;           // 参与者ID
  publicKey: Buffer;    // 公钥
}
```

## 枚举

### MPCComputationType

支持的计算类型。

```typescript
enum MPCComputationType {
  SUM = 'SUM',           // 计算和
  AVERAGE = 'AVERAGE',   // 计算平均值
  MAX = 'MAX',           // 计算最大值
  MIN = 'MIN',           // 计算最小值
  MEDIAN = 'MEDIAN',     // 计算中位数
  VARIANCE = 'VARIANCE', // 计算方差
  MODE = 'MODE',         // 计算众数
  STD_DEV = 'STD_DEV',  // 计算标准差
  QUARTILE = 'QUARTILE',// 计算四分位数
  RANGE = 'RANGE'       // 计算范围
}
```

### MPCMessageType

协议中使用的消息类型。

```typescript
enum MPCMessageType {
  SET_VALUE = 'SET_VALUE',     // 设置值
  SHARE = 'SHARE',             // 共享值
  RESULT = 'RESULT',           // 结果
  RECOVERY = 'RECOVERY',       // 恢复
  VERIFY = 'VERIFY',           // 验证
  COMMITMENT = 'COMMITMENT'    // 承诺
}
```

## 错误处理

### ProtocolError

协议错误类型。

```typescript
enum ProtocolErrorType {
  INVALID_STATE = 'INVALID_STATE',         // 无效状态
  INVALID_MESSAGE = 'INVALID_MESSAGE',     // 无效消息
  TIMEOUT = 'TIMEOUT',                     // 超时
  VERIFICATION_FAILED = 'VERIFICATION_FAILED' // 验证失败
}
```

## 安全特性

### 值盲化

```typescript
private blindValue(value: Buffer): Buffer
```
对值进行盲化处理。
- `value`: 要盲化的值
- 返回: 盲化后的值

### 审计日志

```typescript
interface AuditLog {
  timestamp: Date;      // 时间戳
  event: string;        // 事件类型
  participantId: string;// 参与者ID
  sessionId: string;    // 会话ID
  details: any;         // 详细信息
}
```

## 批处理

### MessageBatch

表示一批要处理的消息。

```typescript
interface MessageBatch {
  messages: Message[];  // 消息列表
  timestamp: Date;      // 时间戳
}
```

## 使用建议

1. 初始化顺序:
```typescript
const protocol = new MPCProtocol();
await protocol.initialize();
await protocol.start();
```

2. 错误处理:
```typescript
try {
  await protocol.startComputation(MPCComputationType.SUM);
} catch (error) {
  if (error.type === ProtocolErrorType.TIMEOUT) {
    // 处理超时
  }
}
```

3. 性能优化:
```typescript
// 根据网络条件调整批处理参数
protocol.setBatchParameters(100, 50);
```

4. 安全性:
- 使用足够长的密钥
- 定期更换会话
- 启用审计日志
- 验证所有输入 