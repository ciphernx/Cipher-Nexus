import { RSA, KeyPair } from '../asymmetric';

describe('RSA', () => {
  let keyPair: KeyPair;
  const testData = Buffer.from('Hello, World!');

  beforeAll(async () => {
    keyPair = await RSA.generateKeyPair();
  });

  it('should generate key pair with correct format', async () => {
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(typeof keyPair.publicKey).toBe('string');
    expect(typeof keyPair.privateKey).toBe('string');
    expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('should encrypt and decrypt data correctly', async () => {
    const encrypted = await RSA.encrypt(testData, keyPair.publicKey);
    const decrypted = await RSA.decrypt(encrypted, keyPair.privateKey);
    
    expect(decrypted.toString()).toBe(testData.toString());
  });

  it('should fail to decrypt with wrong private key', async () => {
    const encrypted = await RSA.encrypt(testData, keyPair.publicKey);
    const wrongKeyPair = await RSA.generateKeyPair();
    
    await expect(RSA.decrypt(encrypted, wrongKeyPair.privateKey)).rejects.toThrow();
  });

  it('should handle small data', async () => {
    const smallData = Buffer.from('A');
    const encrypted = await RSA.encrypt(smallData, keyPair.publicKey);
    const decrypted = await RSA.decrypt(encrypted, keyPair.privateKey);
    
    expect(decrypted.toString()).toBe(smallData.toString());
  });

  it('should fail to encrypt data larger than key size', async () => {
    const largeData = Buffer.alloc(RSA.KEY_SIZE / 8); // Data size equals key size
    largeData.fill('A');
    
    await expect(RSA.encrypt(largeData, keyPair.publicKey)).rejects.toThrow();
  });
}); 