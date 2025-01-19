import { KDF } from '../kdf';

describe('KDF', () => {
  it('should derive different keys for different passwords', async () => {
    const password1 = 'password1';
    const password2 = 'password2';

    const result1 = await KDF.deriveKey(password1);
    const result2 = await KDF.deriveKey(password2);

    // Keys should be different even with same parameters
    expect(result1.key.equals(result2.key)).toBe(false);
    // Salts should be different
    expect(result1.salt.equals(result2.salt)).toBe(false);
  });

  it('should derive same key for same password and salt', async () => {
    const password = 'testpassword';
    const { key, salt } = await KDF.deriveKey(password);

    // Verify the password
    const isValid = await KDF.verifyKey(password, key, salt);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', async () => {
    const password = 'correctpassword';
    const wrongPassword = 'wrongpassword';
    const { key, salt } = await KDF.deriveKey(password);

    // Verify with wrong password
    const isValid = await KDF.verifyKey(wrongPassword, key, salt);
    expect(isValid).toBe(false);
  });

  it('should support custom key lengths', async () => {
    const password = 'testpassword';
    const keyLength = 64; // 512 bits

    const { key } = await KDF.deriveKey(password, keyLength);
    expect(key.length).toBe(keyLength);
  });

  it('should support custom iteration counts', async () => {
    const password = 'testpassword';
    const iterations = 1000;

    // This just verifies the function runs with custom iterations
    const { key, salt } = await KDF.deriveKey(password, undefined, iterations);
    const isValid = await KDF.verifyKey(password, key, salt, undefined, iterations);
    expect(isValid).toBe(true);
  });

  it('should reject keys of different lengths', async () => {
    const password = 'testpassword';
    const { key: key1 } = await KDF.deriveKey(password, 32);
    const { key: key2 } = await KDF.deriveKey(password, 64);

    // Verify with key of different length
    const isValid = await KDF.verifyKey(password, key1, key2);
    expect(isValid).toBe(false);
  });
}); 