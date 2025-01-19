import { ElGamal, ElGamalPublicKey, ElGamalPrivateKey } from '../elgamal';
import { BigInteger } from 'jsbn';

describe('ElGamal Encryption', () => {
  let publicKey: ElGamalPublicKey;
  let privateKey: ElGamalPrivateKey;

  beforeAll(async () => {
    // Generate a smaller key for testing (512 bits instead of 2048)
    const keyPair = await ElGamal.generateKeyPair(512);
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  });

  it('should generate valid key pair', () => {
    expect(publicKey.p).toBeDefined();
    expect(publicKey.g).toBeDefined();
    expect(publicKey.h).toBeDefined();
    expect(privateKey.x).toBeDefined();

    // Verify that h = g^x mod p
    expect(publicKey.g.modPow(privateKey.x, publicKey.p).equals(publicKey.h)).toBe(true);
  });

  it('should encrypt and decrypt messages correctly', async () => {
    const message = new BigInteger('42');
    const ciphertext = await ElGamal.encrypt(message, publicKey);
    const decrypted = await ElGamal.decrypt(ciphertext, privateKey, publicKey);
    
    expect(decrypted.equals(message)).toBe(true);
  });

  it('should support homomorphic multiplication', () => {
    const m1 = new BigInteger('30');
    const m2 = new BigInteger('12');
    
    const c1 = ElGamal.encrypt(m1, publicKey);
    const c2 = ElGamal.encrypt(m2, publicKey);
    
    const cProduct = ElGamal.multiply(c1, c2, publicKey);
    const decryptedProduct = ElGamal.decrypt(cProduct, privateKey, publicKey);
    
    // m1 * m2 mod p
    const expectedProduct = m1.multiply(m2).mod(publicKey.p);
    expect(decryptedProduct.equals(expectedProduct)).toBe(true);
  });

  it('should support exponentiation of ciphertext', () => {
    const message = new BigInteger('10');
    const exponent = new BigInteger('3');
    
    const ciphertext = ElGamal.encrypt(message, publicKey);
    const cPower = ElGamal.power(ciphertext, exponent, publicKey);
    const decryptedPower = ElGamal.decrypt(cPower, privateKey, publicKey);
    
    // message^exponent mod p
    const expectedPower = message.modPow(exponent, publicKey.p);
    expect(decryptedPower.equals(expectedPower)).toBe(true);
  });

  it('should handle identity element (1) correctly', async () => {
    const message = new BigInteger('1');
    const ciphertext = await ElGamal.encrypt(message, publicKey);
    const decrypted = await ElGamal.decrypt(ciphertext, privateKey, publicKey);
    
    expect(decrypted.equals(message)).toBe(true);
  });

  it('should maintain homomorphic properties with multiple operations', () => {
    const m1 = new BigInteger('20');
    const m2 = new BigInteger('30');
    const exp = new BigInteger('2');
    
    const c1 = ElGamal.encrypt(m1, publicKey);
    const c2 = ElGamal.encrypt(m2, publicKey);
    
    // (m1 * m2)^exp mod p
    const cProduct = ElGamal.multiply(c1, c2, publicKey);
    const cResult = ElGamal.power(cProduct, exp, publicKey);
    const decryptedResult = ElGamal.decrypt(cResult, privateKey, publicKey);
    
    const expectedResult = m1.multiply(m2).modPow(exp, publicKey.p);
    expect(decryptedResult.equals(expectedResult)).toBe(true);
  });

  it('should throw error for invalid key sizes', async () => {
    await expect(ElGamal.generateKeyPair(256)).rejects.toThrow();
  });

  it('should throw error for messages larger than modulus', async () => {
    const largeMessage = publicKey.p.add(new BigInteger('1'));
    await expect(ElGamal.encrypt(largeMessage, publicKey)).rejects.toThrow();
  });

  it('should generate different ciphertexts for same message', async () => {
    const message = new BigInteger('42');
    const c1 = await ElGamal.encrypt(message, publicKey);
    const c2 = await ElGamal.encrypt(message, publicKey);
    
    // Due to randomization, c1 and c2 should be different
    expect(c1.c1.equals(c2.c1)).toBe(false);
    expect(c1.c2.equals(c2.c2)).toBe(false);
    
    // But they should decrypt to the same message
    const d1 = await ElGamal.decrypt(c1, privateKey, publicKey);
    const d2 = await ElGamal.decrypt(c2, privateKey, publicKey);
    expect(d1.equals(d2)).toBe(true);
  });
}); 