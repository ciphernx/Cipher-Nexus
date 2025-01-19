# Cipher Nexus 开发指南

## 开发环境设置

### 1. 开发工具
- VSCode 或 WebStorm
- Git
- Node.js v16+
- Docker Desktop
- Postman

### 2. 推荐的VSCode插件
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Docker
- GitLens
- Error Lens

### 3. 代码风格配置
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 项目结构

```
cipher-nexus/
├── packages/
│   ├── protocol/           # 核心协议实现
│   │   ├── src/
│   │   │   ├── token/     # 代币系统
│   │   │   ├── tee/       # TEE环境
│   │   │   └── market/    # 数据市场
│   │   └── tests/
│   ├── core/              # 基础设施
│   │   ├── src/
│   │   │   ├── crypto/    # 加密模块
│   │   │   ├── network/   # 网络模块
│   │   │   └── storage/   # 存储模块
│   │   └── tests/
│   └── api/               # API服务
│       ├── src/
│       │   ├── routes/    # API路由
│       │   ├── services/  # 业务逻辑
│       │   └── models/    # 数据模型
│       └── tests/
├── docs/                  # 文档
├── scripts/              # 工具脚本
└── config/               # 配置文件
```

## 开发流程

### 1. 分支管理
```bash
# 创建功能分支
git checkout -b feature/xxx

# 创建修复分支
git checkout -b fix/xxx

# 提交代码
git add .
git commit -m "feat/fix: 描述"
git push origin feature/xxx
```

### 2. 代码规范
```typescript
// 使用接口定义数据结构
interface UserData {
  id: string;
  name: string;
  email: string;
}

// 使用类型别名定义联合类型
type Status = 'active' | 'inactive' | 'pending';

// 使用类实现业务逻辑
class UserService {
  private users: Map<string, UserData>;

  constructor() {
    this.users = new Map();
  }

  async createUser(data: UserData): Promise<void> {
    // 实现逻辑
  }
}
```

### 3. 测试规范
```typescript
describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('should create user', async () => {
    const userData = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com'
    };

    await service.createUser(userData);
    const user = await service.getUser(userData.id);
    expect(user).toEqual(userData);
  });
});
```

## 组件开发指南

### 1. 代币合约开发
```typescript
// 定义接口
interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  initialSupply: bigint;
}

// 实现合约
class TokenContract extends EventEmitter {
  private config: TokenConfig;
  private balances: Map<string, bigint>;

  constructor(config: TokenConfig) {
    super();
    this.config = config;
    this.balances = new Map();
  }

  // 实现方法
  async transfer(from: string, to: string, amount: bigint): Promise<boolean> {
    // 实现转账逻辑
  }
}
```

### 2. TEE环境开发
```typescript
// 定义配置
interface EnclaveConfig {
  type: 'sgx' | 'trustzone';
  memorySize: number;
  threadCount: number;
}

// 实现管理器
class TrustedExecutionManager {
  private enclaves: Map<string, Enclave>;

  constructor() {
    this.enclaves = new Map();
  }

  // 实现方法
  async createEnclave(config: EnclaveConfig): Promise<string> {
    // 实现创建逻辑
  }
}
```

### 3. 数据市场开发
```typescript
// 定义资产结构
interface DataAsset {
  id: string;
  owner: string;
  metadata: AssetMetadata;
  pricing: PricingInfo;
}

// 实现市场
class DataMarketplace {
  private assets: Map<string, DataAsset>;

  constructor() {
    this.assets = new Map();
  }

  // 实现方法
  async listAsset(asset: DataAsset): Promise<string> {
    // 实现上架逻辑
  }
}
```

## API开发指南

### 1. 路由定义
```typescript
// routes/token.ts
import { Router } from 'express';
import { TokenController } from '../controllers';

const router = Router();

router.post('/transfer', TokenController.transfer);
router.get('/balance/:address', TokenController.getBalance);

export default router;
```

### 2. 控制器实现
```typescript
// controllers/token.ts
import { Request, Response } from 'express';
import { TokenService } from '../services';

export class TokenController {
  static async transfer(req: Request, res: Response) {
    try {
      const { from, to, amount } = req.body;
      await TokenService.transfer(from, to, BigInt(amount));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

### 3. 服务层实现
```typescript
// services/token.ts
import { TokenContract } from '../contracts';

export class TokenService {
  private static contract: TokenContract;

  static initialize(contract: TokenContract) {
    this.contract = contract;
  }

  static async transfer(from: string, to: string, amount: bigint) {
    return this.contract.transfer(from, to, amount);
  }
}
```

## 测试指南

### 1. 单元测试
```typescript
// 测试合约
describe('TokenContract', () => {
  let contract: TokenContract;

  beforeEach(() => {
    contract = new TokenContract({
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 18,
      initialSupply: BigInt(1000000)
    });
  });

  test('transfer should work', async () => {
    const from = 'user1';
    const to = 'user2';
    const amount = BigInt(100);

    await contract.transfer(from, to, amount);
    
    expect(await contract.getBalance(to)).toBe(amount);
  });
});
```

### 2. 集成测试
```typescript
// 测试API
describe('Token API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  test('POST /api/token/transfer', async () => {
    const response = await request(app)
      .post('/api/token/transfer')
      .send({
        from: 'user1',
        to: 'user2',
        amount: '100'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### 3. E2E测试
```typescript
// 测试完整流程
describe('Token Flow', () => {
  test('complete transfer flow', async () => {
    // 创建合约
    const contract = await deployContract();

    // 执行转账
    await contract.transfer(sender, receiver, amount);

    // 验证结果
    const balance = await contract.getBalance(receiver);
    expect(balance).toBe(amount);

    // 检查事件
    const events = await getEvents(contract);
    expect(events).toContainEqual({
      type: 'transfer',
      from: sender,
      to: receiver,
      amount
    });
  });
});
```

## 调试指南

### 1. 日志配置
```typescript
// 配置日志级别
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});
```

### 2. 调试配置
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "program": "${workspaceFolder}/packages/api/src/index.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 3. 性能分析
```typescript
// 使用性能钩子
import { performance } from 'perf_hooks';

async function measurePerformance(fn: () => Promise<void>) {
  const start = performance.now();
  await fn();
  const end = performance.now();
  console.log(`Operation took ${end - start}ms`);
}
```

## 文档编写指南

### 1. 代码注释
```typescript
/**
 * 转账代币
 * @param from 发送方地址
 * @param to 接收方地址
 * @param amount 转账金额
 * @returns 是否成功
 * @throws 余额不足错误
 */
async transfer(
  from: string,
  to: string,
  amount: bigint
): Promise<boolean> {
  // 实现逻辑
}
```

### 2. API文档
```typescript
/**
 * @api {post} /api/token/transfer 转账代币
 * @apiName TransferToken
 * @apiGroup Token
 *
 * @apiParam {String} from 发送方地址
 * @apiParam {String} to 接收方地址
 * @apiParam {String} amount 转账金额
 *
 * @apiSuccess {Boolean} success 是否成功
 *
 * @apiError {String} error 错误信息
 */
```

### 3. 架构文档
```markdown
# 组件名称

## 功能描述
详细描述组件的主要功能和用途

## 技术架构
描述组件的技术实现和架构设计

## 接口定义
列出组件提供的主要接口

## 使用示例
提供具体的使用示例和代码片段
```

## 发布流程

### 1. 版本管理
```bash
# 更新版本号
npm version patch/minor/major

# 生成更新日志
npm run changelog
```

### 2. 代码审查
```bash
# 运行代码检查
npm run lint

# 运行测试
npm run test

# 运行构建
npm run build
```

### 3. 发布流程
```bash
# 合并到主分支
git checkout main
git merge feature/xxx

# 打标签
git tag v1.0.0

# 推送
git push origin main --tags

# 发布
npm publish
``` 