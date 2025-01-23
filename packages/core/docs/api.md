# Homomorphic Encryption API Documentation

## Overview

This package provides a comprehensive implementation of homomorphic encryption with support for parallel computation and advanced caching. The implementation includes multiple encryption schemes, key management, and performance optimizations.

## Core Components

### HomomorphicEncryption

Base class for homomorphic encryption implementations.

```typescript
abstract class HomomorphicEncryption {
  constructor(config: HomomorphicConfig, keyManager: KeyManager);
  
  abstract encrypt(data: number[] | bigint[], keyId: string): Promise<EncryptedData>;
  abstract decrypt(encrypted: EncryptedData, keyId: string): Promise<number[] | bigint[]>;
  abstract add(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;
  abstract multiply(a: EncryptedData, b: EncryptedData): Promise<EncryptedData>;
  abstract relinearize(encrypted: EncryptedData): Promise<EncryptedData>;
  abstract rotate(encrypted: EncryptedData, steps: number): Promise<EncryptedData>;
  abstract rescale(encrypted: EncryptedData): Promise<EncryptedData>;
}
```

### BGV Encryption

Implementation of the BGV (Brakerski-Gentry-Vaikuntanathan) scheme.

```typescript
class BGVEncryption extends HomomorphicEncryption {
  constructor(config: HomomorphicConfig, keyManager: KeyManager);
  
  // Implements all abstract methods from HomomorphicEncryption
  // Additional features specific to BGV scheme
}
```

### Parallel Execution

Utility for parallel processing of homomorphic operations.

```typescript
class ParallelExecutor {
  constructor(config?: ParallelConfig);
  
  executeParallel<T, R>(tasks: ParallelTask<T, R>[], workerScript: string): Promise<ParallelResult<R>[]>;
  executeTask<T, R>(task: ParallelTask<T, R>): Promise<ParallelResult<R>>;
  terminate(): Promise<void>;
}

interface ParallelConfig {
  maxWorkers?: number;        // Default: CPU cores count
  minBatchSize?: number;      // Default: 1000
  enableThreadPool?: boolean; // Default: true
}
```

### Advanced Caching

Memory-aware caching system with LRU and TTL support.

```typescript
class AdvancedCache<T> extends EventEmitter {
  constructor(config?: CacheConfig);
  
  set(key: string, value: T, size?: number): void;
  get(key: string): T | undefined;
  delete(key: string): boolean;
  clear(): void;
  getStats(): CacheStats;
  destroy(): void;
}

interface CacheConfig {
  maxSize?: number;        // Maximum cache size in bytes
  maxEntries?: number;     // Maximum number of entries
  ttl?: number;           // Time to live in milliseconds
  checkPeriod?: number;   // Cleanup check period
  maxMemoryUsage?: number; // Maximum memory usage (0-1)
}
```

## Usage Examples

### Basic Encryption

```typescript
import { BGVEncryption, KeyManager, FileKeyStorage } from '@cipher-nexus/core';

// Initialize components
const keyStorage = new FileKeyStorage();
const keyManager = new KeyManager(keyStorage);
const config = {
  scheme: HomomorphicScheme.BGV,
  polyModulusDegree: 8192,
  securityLevel: 128
};
const encryption = new BGVEncryption(config, keyManager);

// Encrypt data
const keyId = await keyManager.generateKey(config);
const data = [1, 2, 3, 4];
const encrypted = await encryption.encrypt(data, keyId);

// Perform homomorphic operations
const sum = await encryption.add(encrypted, encrypted);
const product = await encryption.multiply(encrypted, encrypted);

// Decrypt results
const decryptedSum = await encryption.decrypt(sum, keyId);
const decryptedProduct = await encryption.decrypt(product, keyId);
```

### Parallel Processing

```typescript
import { ParallelExecutor } from '@cipher-nexus/core';

const executor = new ParallelExecutor({
  maxWorkers: 4,
  minBatchSize: 1000
});

// Prepare tasks
const tasks = data.map(item => ({
  data: item,
  operation: 'encrypt',
  params: { keyId }
}));

// Execute in parallel
const results = await executor.executeParallel(tasks, './worker.js');
```

### Advanced Caching

```typescript
import { AdvancedCache } from '@cipher-nexus/core';

const cache = new AdvancedCache({
  maxSize: 100 * 1024 * 1024, // 100MB
  maxEntries: 1000,
  ttl: 3600000, // 1 hour
  maxMemoryUsage: 0.8 // 80%
});

// Handle memory pressure
cache.on('memory-pressure', () => {
  console.log('Memory usage high, evicting entries...');
});

// Cache encrypted data
cache.set('encrypted:1', encryptedData);
const cached = cache.get('encrypted:1');

// Monitor cache statistics
const stats = cache.getStats();
console.log(`Cache size: ${stats.size} bytes`);
console.log(`Entries: ${stats.entries}`);
console.log(`Memory usage: ${stats.memoryUsage * 100}%`);
```

## Best Practices

1. **Key Management**
   - Regularly rotate encryption keys
   - Implement secure key backup and recovery
   - Use appropriate security levels based on data sensitivity

2. **Performance Optimization**
   - Use parallel execution for large datasets
   - Configure cache size based on available memory
   - Monitor and adjust batch sizes for optimal performance

3. **Security Considerations**
   - Validate all input parameters
   - Implement proper error handling
   - Monitor and log security-related events

4. **Resource Management**
   - Clean up workers after use
   - Implement proper cache eviction strategies
   - Monitor memory usage and handle pressure events

## Error Handling

The package uses typed errors for different scenarios:

```typescript
class HomomorphicError extends Error {
  constructor(message: string, code: string);
}

class ValidationError extends HomomorphicError {}
class SecurityError extends HomomorphicError {}
class OperationError extends HomomorphicError {}
```

Example error handling:

```typescript
try {
  const encrypted = await encryption.encrypt(data, keyId);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof SecurityError) {
    // Handle security-related errors
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

1. **Batch Processing**
   - Use parallel execution for large datasets
   - Configure appropriate batch sizes
   - Monitor worker pool utilization

2. **Caching Strategy**
   - Configure cache size based on available memory
   - Implement proper eviction policies
   - Monitor cache hit rates

3. **Memory Management**
   - Monitor memory usage
   - Handle memory pressure events
   - Implement cleanup strategies

## Security Recommendations

1. **Key Management**
   - Implement secure key storage
   - Regular key rotation
   - Proper access control

2. **Parameter Selection**
   - Use appropriate security levels
   - Validate all input parameters
   - Monitor security events

3. **Error Handling**
   - Implement proper error handling
   - Log security-related events
   - Regular security audits

# Key Backup Management

The `KeyBackupManager` class provides functionality for securely backing up and restoring encryption keys. It supports encrypted backups with integrity verification and automatic cleanup of old backups.

## Configuration

```typescript
interface BackupConfig {
  backupPath: string;        // Directory to store backups
  encryptionKey: Buffer;     // Key used to encrypt backups
  maxBackups: number;        // Maximum number of backups to retain
  compressionEnabled?: boolean; // Whether to compress backups (default: true)
}
```

## Usage

### Creating a Backup

```typescript
const backupManager = new KeyBackupManager(config, auditLogger);

// Backup keys with optional metadata
const backupId = await backupManager.createBackup(
  [
    { id: 'key1', data: key1Buffer },
    { id: 'key2', data: key2Buffer }
  ],
  { description: 'Monthly backup' }
);
```

### Restoring from Backup

```typescript
// Restore all keys from backup
const allKeys = await backupManager.restoreBackup(backupId);

// Restore specific keys
const selectedKeys = await backupManager.restoreBackup(backupId, ['key1']);
```

### Managing Backups

```typescript
// List available backups
const backups = await backupManager.listBackups();

// Verify backup integrity
const isValid = await backupManager.verifyBackup(backupId);
```

## Security Features

- AES-256-GCM encryption for backup data
- SHA-256 checksums for integrity verification
- Automatic cleanup of old backups
- Audit logging of all backup operations

## Best Practices

1. Store the backup encryption key securely and separately from the backups
2. Regularly verify backup integrity
3. Implement a rotation schedule for backups
4. Monitor audit logs for backup operations
5. Test backup restoration periodically

## Error Handling

The backup manager throws errors in the following cases:
- Invalid backup ID during restoration
- Backup integrity check failure
- File system errors
- Encryption/decryption errors

All operations are logged through the audit logger with appropriate severity levels. 