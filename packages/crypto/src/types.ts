export interface EncryptionConfig {
  algorithm: 'RSA' | 'AES' | 'FHE';
  keySize: number;
  mode?: string;
}

export interface EncryptionKey {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedData {
  data: string;
  iv?: string;
  tag?: string;
} 