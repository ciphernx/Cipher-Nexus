/// <reference types="jest" />
import { Buffer } from 'buffer';

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: (size: number) => Buffer.from('0'.repeat(size * 2), 'hex'),
  createHash: () => ({
    update: () => ({
      digest: () => 'mocked_hash'
    })
  }),
  createCipheriv: () => ({
    update: (data: Buffer) => data,
    final: () => Buffer.alloc(0),
    getAuthTag: () => Buffer.alloc(16)
  }),
  createDecipheriv: () => ({
    update: (data: Buffer) => data,
    final: () => Buffer.alloc(0),
    setAuthTag: () => {}
  })
}));

// Mock fs-extra module
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
  remove: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue(['test.key'])
}));

// Set global test timeout
jest.setTimeout(10000); 