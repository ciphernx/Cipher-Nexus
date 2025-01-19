import { Hash, Signature } from '../hash';
import { RSA } from '../asymmetric';

describe('Hash', () => {
  const testData = Buffer.from('Hello, World!');
  const testKey = Buffer.from('secret-key');

  it('should generate consistent SHA-256 hashes', async () => {
    const hash1 = await Hash.sha256(testData);
    const hash2 = await Hash.sha256(testData);
    
    expect(hash1.equals(hash2)).toBe(true);
  });

  it('should generate different hashes for different data', async () => {
    const hash1 = await Hash.sha256(testData);
    const hash2 = await Hash.sha256(Buffer.from('Different data'));
    
    expect(hash1.equals(hash2)).toBe(false);
  });

  it('should generate consistent HMAC values', async () => {
    const hmac1 = await Hash.hmac(testData, testKey);
    const hmac2 = await Hash.hmac(testData, testKey);
    
    expect(hmac1.equals(hmac2)).toBe(true);
  });

  it('should generate different HMAC values for different keys', async () => {
    const hmac1 = await Hash.hmac(testData, testKey);
    const hmac2 = await Hash.hmac(testData, Buffer.from('different-key'));
    
    expect(hmac1.equals(hmac2)).toBe(false);
  });
});

describe('Signature', () => {
  const testData = Buffer.from('Hello, World!');
  let keyPair: Awaited<ReturnType<typeof RSA.generateKeyPair>>;

  beforeAll(async () => {
    keyPair = await RSA.generateKeyPair();
  });

  it('should sign and verify data correctly', async () => {
    const signature = await Signature.sign(testData, keyPair.privateKey);
    const isValid = await Signature.verify(testData, signature, keyPair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should fail verification with wrong public key', async () => {
    const signature = await Signature.sign(testData, keyPair.privateKey);
    const wrongKeyPair = await RSA.generateKeyPair();
    
    const isValid = await Signature.verify(testData, signature, wrongKeyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should fail verification with modified data', async () => {
    const signature = await Signature.sign(testData, keyPair.privateKey);
    const modifiedData = Buffer.from('Modified data');
    
    const isValid = await Signature.verify(modifiedData, signature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should fail verification with modified signature', async () => {
    const signature = await Signature.sign(testData, keyPair.privateKey);
    const modifiedSignature = Buffer.from(signature); // Create a copy
    modifiedSignature[0] ^= 1; // Modify one bit
    
    const isValid = await Signature.verify(testData, modifiedSignature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });
}); 