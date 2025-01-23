import { promises as fs } from 'fs';
import { join } from 'path';
import { HomomorphicKeyPair } from '../HomomorphicEncryption';
import { KeyMetadata } from '../KeyManager';

/**
 * Interface for key storage implementations
 */
export interface KeyStorage {
  store(keyId: string, keyPair: HomomorphicKeyPair, metadata: KeyMetadata): Promise<void>;
  retrieve(keyId: string): Promise<{ keyPair: HomomorphicKeyPair; metadata: KeyMetadata } | null>;
  list(): Promise<KeyMetadata[]>;
  delete(keyId: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * File-based key storage implementation
 */
export class FileKeyStorage implements KeyStorage {
  private readonly dataPath: string;
  private readonly indexPath: string;

  constructor(basePath: string) {
    this.dataPath = join(basePath, 'keys');
    this.indexPath = join(basePath, 'index.json');
  }

  async initialize(): Promise<void> {
    // Create storage directory if it doesn't exist
    await fs.mkdir(this.dataPath, { recursive: true });
    
    // Initialize index file if it doesn't exist
    try {
      await fs.access(this.indexPath);
    } catch {
      await fs.writeFile(this.indexPath, JSON.stringify({}));
    }
  }

  async store(
    keyId: string,
    keyPair: HomomorphicKeyPair,
    metadata: KeyMetadata
  ): Promise<void> {
    // Store key data
    const keyPath = join(this.dataPath, `${keyId}.json`);
    await fs.writeFile(
      keyPath,
      JSON.stringify({ keyPair, metadata }, null, 2)
    );

    // Update index
    const index = await this.readIndex();
    index[keyId] = metadata;
    await this.writeIndex(index);
  }

  async retrieve(
    keyId: string
  ): Promise<{ keyPair: HomomorphicKeyPair; metadata: KeyMetadata } | null> {
    try {
      const keyPath = join(this.dataPath, `${keyId}.json`);
      const data = await fs.readFile(keyPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async list(): Promise<KeyMetadata[]> {
    const index = await this.readIndex();
    return Object.values(index);
  }

  async delete(keyId: string): Promise<void> {
    // Delete key file
    const keyPath = join(this.dataPath, `${keyId}.json`);
    try {
      await fs.unlink(keyPath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Update index
    const index = await this.readIndex();
    delete index[keyId];
    await this.writeIndex(index);
  }

  async clear(): Promise<void> {
    // Delete all key files
    const files = await fs.readdir(this.dataPath);
    await Promise.all(
      files.map(file => fs.unlink(join(this.dataPath, file)))
    );

    // Clear index
    await this.writeIndex({});
  }

  private async readIndex(): Promise<Record<string, KeyMetadata>> {
    const data = await fs.readFile(this.indexPath, 'utf8');
    return JSON.parse(data);
  }

  private async writeIndex(index: Record<string, KeyMetadata>): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }
}

/**
 * Database key storage implementation
 */
export class DatabaseKeyStorage implements KeyStorage {
  constructor(
    private readonly client: any, // Database client (e.g., MongoDB, PostgreSQL)
    private readonly config: {
      keyCollection: string;
      metadataCollection: string;
    }
  ) {}

  async initialize(): Promise<void> {
    // Create collections/tables if they don't exist
    await this.createSchema();
  }

  async store(
    keyId: string,
    keyPair: HomomorphicKeyPair,
    metadata: KeyMetadata
  ): Promise<void> {
    // Store key data and metadata in separate collections
    await Promise.all([
      this.client.collection(this.config.keyCollection).updateOne(
        { _id: keyId },
        { $set: { keyPair } },
        { upsert: true }
      ),
      this.client.collection(this.config.metadataCollection).updateOne(
        { _id: keyId },
        { $set: metadata },
        { upsert: true }
      )
    ]);
  }

  async retrieve(
    keyId: string
  ): Promise<{ keyPair: HomomorphicKeyPair; metadata: KeyMetadata } | null> {
    // Retrieve key data and metadata
    const [keyData, metadata] = await Promise.all([
      this.client.collection(this.config.keyCollection).findOne({ _id: keyId }),
      this.client.collection(this.config.metadataCollection).findOne({ _id: keyId })
    ]);

    if (!keyData || !metadata) return null;

    return {
      keyPair: keyData.keyPair,
      metadata
    };
  }

  async list(): Promise<KeyMetadata[]> {
    // List all metadata
    return this.client
      .collection(this.config.metadataCollection)
      .find()
      .toArray();
  }

  async delete(keyId: string): Promise<void> {
    // Delete key data and metadata
    await Promise.all([
      this.client.collection(this.config.keyCollection).deleteOne({ _id: keyId }),
      this.client.collection(this.config.metadataCollection).deleteOne({ _id: keyId })
    ]);
  }

  async clear(): Promise<void> {
    // Clear all collections
    await Promise.all([
      this.client.collection(this.config.keyCollection).deleteMany({}),
      this.client.collection(this.config.metadataCollection).deleteMany({})
    ]);
  }

  private async createSchema(): Promise<void> {
    // Create collections with indexes
    await Promise.all([
      this.client.createCollection(this.config.keyCollection),
      this.client.createCollection(this.config.metadataCollection)
    ]);

    // Create indexes
    await Promise.all([
      this.client
        .collection(this.config.metadataCollection)
        .createIndex({ status: 1 }),
      this.client
        .collection(this.config.metadataCollection)
        .createIndex({ createdAt: 1 })
    ]);
  }
} 