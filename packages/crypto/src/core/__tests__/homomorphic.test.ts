import { Paillier, PaillierKeyPair } from '../homomorphic';

describe('Paillier Homomorphic Encryption', () => {
  let keyPair: PaillierKeyPair;

  beforeAll(async () => {
    // Generate a smaller key for testing (512 bits instead of 2048)
    keyPair = await Paillier.generateKeyPair(512);
  });

  it('should generate valid key pair', () => {
    expect(keyPair.publicKey.n).toBeDefined();
    expect(keyPair.publicKey.g).toBeDefined();
    expect(keyPair.privateKey.lambda).toBeDefined();
    expect(keyPair.privateKey.mu).toBeDefined();
    expect(keyPair.privateKey.p).toBeDefined();
    expect(keyPair.privateKey.q).toBeDefined();
  });

  it('should encrypt and decrypt numbers correctly', async () => {
    const message = 42;
    const ciphertext = await Paillier.encrypt(message, keyPair.publicKey);
    const decrypted = await Paillier.decrypt(ciphertext, keyPair);
    
    expect(decrypted).toBe(message);
  });

  it('should support homomorphic addition', async () => {
    const m1 = 30;
    const m2 = 12;
    
    const c1 = await Paillier.encrypt(m1, keyPair.publicKey);
    const c2 = await Paillier.encrypt(m2, keyPair.publicKey);
    
    const cSum = await Paillier.add(c1, c2, keyPair.publicKey);
    const decryptedSum = await Paillier.decrypt(cSum, keyPair);
    
    expect(decryptedSum).toBe(m1 + m2);
  });

  it('should support multiplication by constant', async () => {
    const message = 10;
    const multiplier = 5;
    
    const ciphertext = await Paillier.encrypt(message, keyPair.publicKey);
    const cProduct = await Paillier.multiplyByConstant(ciphertext, multiplier, keyPair.publicKey);
    const decryptedProduct = await Paillier.decrypt(cProduct, keyPair);
    
    expect(decryptedProduct).toBe(message * multiplier);
  });

  it('should handle zero correctly', async () => {
    const message = 0;
    const ciphertext = await Paillier.encrypt(message, keyPair.publicKey);
    const decrypted = await Paillier.decrypt(ciphertext, keyPair);
    
    expect(decrypted).toBe(0);
  });

  it('should handle negative numbers through modular arithmetic', async () => {
    const message = -15;
    const ciphertext = await Paillier.encrypt(message, keyPair.publicKey);
    const decrypted = await Paillier.decrypt(ciphertext, keyPair);
    
    expect(decrypted).toBe(message);
  });

  it('should maintain homomorphic properties with multiple operations', async () => {
    const m1 = 20;
    const m2 = 30;
    const m3 = 5;
    
    const c1 = await Paillier.encrypt(m1, keyPair.publicKey);
    const c2 = await Paillier.encrypt(m2, keyPair.publicKey);
    const c3 = await Paillier.encrypt(m3, keyPair.publicKey);
    
    // (m1 + m2) * m3
    const cSum = await Paillier.add(c1, c2, keyPair.publicKey);
    const cResult = await Paillier.multiplyByConstant(cSum, m3, keyPair.publicKey);
    const decryptedResult = await Paillier.decrypt(cResult, keyPair);
    
    expect(decryptedResult).toBe((m1 + m2) * m3);
  });

  it('should throw error for invalid key sizes', async () => {
    await expect(Paillier.generateKeyPair(256)).rejects.toThrow();
  });

  it('should throw error for invalid message range', async () => {
    const message = Number.MAX_SAFE_INTEGER + 1;
    await expect(Paillier.encrypt(message, keyPair.publicKey)).rejects.toThrow();
  });
}); 