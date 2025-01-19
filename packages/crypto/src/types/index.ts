export interface EncryptionKey {
  publicKey: string;
  privateKey: string;
}

export interface EncryptionConfig {
  algorithm: 'AES' | 'RSA' | 'FHE';
  keySize: number;
  mode?: string;
}

export interface EncryptedData {
  data: string;
  iv?: string;
  tag?: string;
}
