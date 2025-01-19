# Cipher Nexus API 文档

## 目录

1. [代币合约 API](#代币合约-api)
2. [代币经济 API](#代币经济-api)
3. [TEE 环境 API](#tee-环境-api)
4. [数据市场 API](#数据市场-api)

## 代币合约 API

### 基础信息

#### 获取代币信息
```typescript
getInfo(): TokenInfo
```
返回代币的基本信息，包括：
- symbol: 代币符号
- name: 代币名称
- decimals: 小数位数
- totalSupply: 总供应量
- owner: 所有者地址

#### 获取代币指标
```typescript
getMetrics(): TokenMetrics
```
返回代币的运行指标，包括：
- holders: 持有者数量
- transactions: 交易数量
- volume: 交易量
- marketCap: 市值

### 余额和授权

#### 查询余额
```typescript
getBalance(address: string): bigint
```
查询指定地址的代币余额。

#### 查询授权额度
```typescript
getAllowance(owner: string, spender: string): bigint
```
查询授权给指定地址的代币额度。

### 转账操作

#### 转账
```typescript
async transfer(from: string, to: string, amount: bigint): Promise<boolean>
```
从一个地址转账到另一个地址。

#### 授权转账
```typescript
async approve(owner: string, spender: string, amount: bigint, expiry?: Date): Promise<boolean>
```
授权其他地址使用代币。

#### 授权转账执行
```typescript
async transferFrom(spender: string, from: string, to: string, amount: bigint): Promise<boolean>
```
使用授权额度进行转账。

### 锁定机制

#### 锁定代币
```typescript
async lock(address: string, amount: bigint, reason: string): Promise<boolean>
```
锁定指定地址的代币。

#### 解锁代币
```typescript
async unlock(address: string, amount: bigint, reason: string): Promise<boolean>
```
解锁指定地址的代币。

### 铸造和销毁

#### 铸造代币
```typescript
async mint(to: string, amount: bigint): Promise<boolean>
```
铸造新代币到指定地址。

#### 销毁代币
```typescript
async burn(from: string, amount: bigint): Promise<boolean>
```
从指定地址销毁代币。

## 代币经济 API

### 质押系统

#### 质押代币
```typescript
async stake(address: string, amount: bigint, lockPeriod: number): Promise<boolean>
```
质押代币到系统中。

#### 解除质押
```typescript
async unstake(address: string, amount: bigint): Promise<boolean>
```
从系统中解除质押。

#### 领取奖励
```typescript
async claimRewards(address: string): Promise<bigint>
```
领取质押奖励。

### 治理系统

#### 创建提案
```typescript
async createProposal(
  proposer: string,
  title: string,
  description: string,
  votingPeriod: number,
  quorum: bigint,
  threshold: number
): Promise<string>
```
创建新的治理提案。

#### 投票
```typescript
async vote(voter: string, proposalId: string, support: boolean): Promise<boolean>
```
对提案进行投票。

#### 执行提案
```typescript
async executeProposal(proposalId: string): Promise<boolean>
```
执行已通过的提案。

### 查询接口

#### 查询质押信息
```typescript
getStakingPosition(address: string): StakingPosition | undefined
```
查询地址的质押信息。

#### 查询提案信息
```typescript
getProposal(proposalId: string): GovernanceProposal | undefined
```
查询提案详情。

#### 查询投票记录
```typescript
getVotes(proposalId: string): Vote[]
```
查询提案的投票记录。

## TEE 环境 API

### Enclave 管理

#### 创建 Enclave
```typescript
async createEnclave(
  type: 'sgx' | 'trustzone' | 'cxl',
  memorySize: number,
  threadCount: number,
  securityLevel: 'high' | 'medium' | 'low'
): Promise<string>
```
创建新的可信执行环境。

#### 执行代码
```typescript
async executeCode(enclaveId: string, code: string, input: any): Promise<ExecutionResult>
```
在可信环境中执行代码。

#### 销毁 Enclave
```typescript
async destroyEnclave(enclaveId: string): Promise<void>
```
销毁可信执行环境。

### 监控和统计

#### 获取统计信息
```typescript
async getStats(): Promise<TEEStats>
```
获取TEE环境的运行统计。

## 数据市场 API

### 资产管理

#### 上架资产
```typescript
async listAsset(asset: DataAsset): Promise<string>
```
在市场上架数据资产。

#### 购买访问权限
```typescript
async purchaseAccess(assetId: string, buyer: string, amount: number): Promise<void>
```
购买数据资产的访问权限。

#### 请求访问
```typescript
async requestAccess(request: AccessRequest): Promise<string>
```
请求访问数据资产。

### 查询接口

#### 查询资产
```typescript
async getAsset(assetId: string): Promise<DataAsset | undefined>
```
查询资产详情。

#### 查询访问请求
```typescript
async getAccessRequest(requestId: string): Promise<AccessRequest | undefined>
```
查询访问请求状态。

## 事件系统

所有组件都继承自 EventEmitter，支持以下事件：

### 代币合约事件
- transfer: 转账事件
- approval: 授权事件
- locked: 锁定事件
- unlocked: 解锁事件
- mint: 铸造事件
- burn: 销毁事件
- marketCapUpdated: 市值更新事件

### 代币经济事件
- staked: 质押事件
- unstaked: 解除质押事件
- rewardsClaimed: 领取奖励事件
- proposalCreated: 创建提案事件
- voted: 投票事件
- proposalExecuted: 提案执行事件

### TEE 环境事件
- enclaveCreated: 创建环境事件
- enclaveStarted: 环境启动事件
- enclaveStopped: 环境停止事件
- executionCompleted: 执行完成事件
- attestationVerified: 认证验证事件

### 数据市场事件
- assetListed: 资产上架事件
- accessPurchased: 购买访问事件
- accessRequested: 请求访问事件
- accessApproved: 批准访问事件

### 错误处理
所有组件都支持 error 事件，用于错误处理：
```typescript
component.on('error', (error) => {
  console.error('Error occurred:', error);
});
``` 