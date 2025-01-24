# Crypto Package API Documentation

## Overview

The Crypto package provides cryptographic primitives and protocols for secure computation and privacy protection.

## Core Components

### HomomorphicEncryption

```typescript
class HomomorphicEncryption {
  constructor(config: HomomorphicConfig);
  
  async initialize(): Promise<void>;
  async encrypt(data: number[]): Promise<EncryptedData>;
  async decrypt(data: EncryptedData): Promise<number[]>;
  async add(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;
  async multiply(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;
}
```

### ZeroKnowledgeProof

```typescript
class ZeroKnowledgeProof {
  constructor(config: ZKPConfig);
  
  async generateProof(
    statement: any,
    witness: any,
    context: ProofContext
  ): Promise<Proof>;
  
  async verifyProof(
    proof: Proof,
    context: ProofContext
  ): Promise<boolean>;
}
```

### DifferentialPrivacy

```typescript
class DifferentialPrivacy {
  constructor(config: DPConfig);
  
  async addNoise(data: number[]): Promise<number[]>;
  async computeSensitivity(query: Query): Promise<number>;
  async verifyPrivacy(epsilon: number, delta: number): Promise<boolean>;
}
```

### KeyManager

```typescript
class KeyManager {
  constructor(config: KeyConfig);
  
  async generateKeyPair(): Promise<KeyPair>;
  async storeKey(keyId: string, key: Key): Promise<void>;
  async retrieveKey(keyId: string): Promise<Key>;
  async rotateKey(keyId: string): Promise<KeyPair>;
}
```

## Configuration Types

### HomomorphicConfig

```typescript
interface HomomorphicConfig {
  polyModulusDegree: number;
  coeffModulusBits: number[];
  scaleBits: number;
  maxThreads?: number;
  useGPU?: boolean;
  securityLevel: number;
}
```

### ZKPConfig

```typescript
interface ZKPConfig {
  securityParameter: number;
  numIterations: number;
  hashFunction: string;
  proofTimeout: number;
  maxProofSize: number;
  maxConstraints: number;
  fieldSize: bigint;
}
```

### DPConfig

```typescript
interface DPConfig {
  epsilon: number;
  delta: number;
  maxGradientNorm: number;
  noiseMultiplier: number;
  minBatchSize: number;
  maxReservedBudget: number;
}
```

### KeyConfig

```typescript
interface KeyConfig {
  algorithm: string;
  keySize: number;
  storageType: 'memory' | 'file' | 'database';
  rotationPeriod: number;
}
```

## Usage Examples

### Homomorphic Encryption

```typescript
const encryption = new HomomorphicEncryption({
  polyModulusDegree: 8192,
  coeffModulusBits: [60, 40, 40, 60],
  scaleBits: 40,
  securityLevel: 128
});

const encrypted = await encryption.encrypt(data);
const result = await encryption.add(encrypted, encrypted);
const decrypted = await encryption.decrypt(result);
```

### Zero Knowledge Proof

```typescript
const zkp = new ZeroKnowledgeProof({
  securityParameter: 128,
  numIterations: 10,
  hashFunction: 'sha256'
});

const proof = await zkp.generateProof(statement, witness, context);
const isValid = await zkp.verifyProof(proof, context);
```

### Differential Privacy

```typescript
const dp = new DifferentialPrivacy({
  epsilon: 0.1,
  delta: 1e-5,
  maxGradientNorm: 1.0
});

const privatized = await dp.addNoise(data);
```

### Key Management

```typescript
const keyManager = new KeyManager({
  algorithm: 'RSA',
  keySize: 2048,
  storageType: 'database',
  rotationPeriod: 30 * 24 * 60 * 60 // 30 days
});

const keyPair = await keyManager.generateKeyPair();
await keyManager.storeKey('key1', keyPair.publicKey);
``` 