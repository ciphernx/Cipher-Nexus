import { AES, SymmetricKey } from '../symmetric';

describe('AES', () => {
  let key: SymmetricKey;
  const testData = Buffer.from('Hello, World!');

  beforeAll(async () => {
    key = await AES.generateKey();
  });

  it('should generate key with correct sizes', async () => {
    expect(key.key.length).toBe(AES.KEY_SIZE);
    expect(key.iv.length).toBe(AES.IV_SIZE);
  });

  it('should encrypt and decrypt data correctly', async () => {
    const encrypted = await AES.encrypt(testData, key);
    const decrypted = await AES.decrypt(encrypted, key.key);
    
    expect(decrypted.toString()).toBe(testData.toString());
  });

  it('should fail to decrypt with wrong key', async () => {
    const encrypted = await AES.encrypt(testData, key);
    const wrongKey = Buffer.alloc(AES.KEY_SIZE);
    
    await expect(AES.decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should handle empty data', async () => {
    const emptyData = Buffer.from('');
    const encrypted = await AES.encrypt(emptyData, key);
    const decrypted = await AES.decrypt(encrypted, key.key);
    
    expect(decrypted.length).toBe(0);
  });

  it('should handle large data', async () => {
    const largeData = Buffer.alloc(1024 * 1024); // 1MB
    largeData.fill('A');
    
    const encrypted = await AES.encrypt(largeData, key);
    const decrypted = await AES.decrypt(encrypted, key.key);
    
    expect(decrypted.toString()).toBe(largeData.toString());
  });
}); 