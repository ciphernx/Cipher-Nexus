import { expect } from 'chai';
import { AES, AESParams, AESMode } from '../aes';
import { randomBytes } from 'crypto';

describe('AES', () => {
  const message = 'Hello, AES!';
  const key = randomBytes(32); // AES-256
  const iv = randomBytes(16);

  const params: AESParams = {
    key,
    iv,
    mode: AESMode.CBC
  };

  it('should encrypt and decrypt correctly in CBC mode', async () => {
    const ciphertext = await AES.encrypt(Buffer.from(message), params);
    const decrypted = await AES.decrypt(ciphertext, params);
    expect(decrypted.toString()).to.equal(message);
  });

  it('should encrypt and decrypt correctly in GCM mode', async () => {
    const gcmParams: AESParams = {
      ...params,
      mode: AESMode.GCM
    };

    const { ciphertext, tag } = await AES.encryptGCM(Buffer.from(message), gcmParams);
    const decrypted = await AES.decryptGCM(ciphertext, tag, gcmParams);
    expect(decrypted.toString()).to.equal(message);
  });

  it('should produce different ciphertexts for same plaintext', async () => {
    const params1: AESParams = {
      key,
      iv: randomBytes(16),
      mode: AESMode.CBC
    };

    const params2: AESParams = {
      key,
      iv: randomBytes(16),
      mode: AESMode.CBC
    };

    const ciphertext1 = await AES.encrypt(Buffer.from(message), params1);
    const ciphertext2 = await AES.encrypt(Buffer.from(message), params2);
    expect(ciphertext1).to.not.deep.equal(ciphertext2);
  });

  it('should handle different key sizes', async () => {
    const keySizes = [16, 24, 32]; // AES-128, AES-192, AES-256

    for (const keySize of keySizes) {
      const params: AESParams = {
        key: randomBytes(keySize),
        iv,
        mode: AESMode.CBC
      };

      const ciphertext = await AES.encrypt(Buffer.from(message), params);
      const decrypted = await AES.decrypt(ciphertext, params);
      expect(decrypted.toString()).to.equal(message);
    }
  });

  it('should detect tampering in GCM mode', async () => {
    const gcmParams: AESParams = {
      key,
      iv,
      mode: AESMode.GCM
    };

    const { ciphertext, tag } = await AES.encryptGCM(Buffer.from(message), gcmParams);
    
    // Tamper with ciphertext
    ciphertext[0] ^= 1;
    
    await expect(AES.decryptGCM(ciphertext, tag, gcmParams))
      .to.be.rejectedWith('Decryption failed');
  });

  it('should handle different message types', async () => {
    const testCases = [
      'Regular string',
      Buffer.from([0x00, 0xFF, 0x10, 0xAB]), // Binary data
      Buffer.alloc(1024).fill('A'), // Large message
      '', // Empty message
      '🔑🔒' // Unicode string
    ];

    for (const msg of testCases) {
      const ciphertext = await AES.encrypt(Buffer.from(msg), params);
      const decrypted = await AES.decrypt(ciphertext, params);
      expect(decrypted.toString()).to.equal(msg);
    }
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(AES.encrypt(Buffer.from(message), {
      key: randomBytes(15), // Not 16, 24, or 32 bytes
      iv,
      mode: AESMode.CBC
    })).to.be.rejectedWith('Invalid key length');

    // Invalid IV size
    await expect(AES.encrypt(Buffer.from(message), {
      key,
      iv: randomBytes(15), // Not 16 bytes
      mode: AESMode.CBC
    })).to.be.rejectedWith('Invalid IV length');
  });

  it('should be deterministic with same IV', async () => {
    const fixedIV = Buffer.alloc(16).fill(0);
    const params1: AESParams = {
      key,
      iv: fixedIV,
      mode: AESMode.CBC
    };

    const params2 = { ...params1 };

    const ciphertext1 = await AES.encrypt(Buffer.from(message), params1);
    const ciphertext2 = await AES.encrypt(Buffer.from(message), params2);
    expect(ciphertext1).to.deep.equal(ciphertext2);
  });

  it('should handle large data efficiently', async () => {
    const largeData = randomBytes(1024 * 1024); // 1MB
    const ciphertext = await AES.encrypt(largeData, params);
    const decrypted = await AES.decrypt(ciphertext, params);
    expect(decrypted).to.deep.equal(largeData);
  });

  it('should support streaming encryption', async () => {
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    const aes = new AES(params);
    let ciphertext = Buffer.alloc(0);
    for (const chunk of chunks) {
      ciphertext = Buffer.concat([ciphertext, await aes.update(chunk)]);
    }
    ciphertext = Buffer.concat([ciphertext, await aes.final()]);

    const decrypted = await AES.decrypt(ciphertext, params);
    expect(decrypted.toString()).to.equal(chunks.map(c => c.toString()).join(''));
  });
}); 