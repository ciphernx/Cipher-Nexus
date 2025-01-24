import { expect } from 'chai';
import { ChaCha20Poly1305, ChaChaParams } from '../chacha20-poly1305';
import { randomBytes } from 'crypto';

describe('ChaCha20-Poly1305', () => {
  const message = 'Hello, ChaCha20-Poly1305!';
  const key = randomBytes(32);
  const nonce = randomBytes(12);

  const params: ChaChaParams = {
    key,
    nonce
  };

  it('should encrypt and decrypt correctly', async () => {
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(Buffer.from(message), params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
    expect(decrypted.toString()).to.equal(message);
  });

  it('should produce different ciphertexts for same plaintext', async () => {
    const params1: ChaChaParams = {
      key,
      nonce: randomBytes(12)
    };

    const params2: ChaChaParams = {
      key,
      nonce: randomBytes(12)
    };

    const result1 = await ChaCha20Poly1305.encrypt(Buffer.from(message), params1);
    const result2 = await ChaCha20Poly1305.encrypt(Buffer.from(message), params2);

    expect(result1.ciphertext).to.not.deep.equal(result2.ciphertext);
    expect(result1.tag).to.not.deep.equal(result2.tag);
  });

  it('should detect tampering', async () => {
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(Buffer.from(message), params);
    
    // Tamper with ciphertext
    ciphertext[0] ^= 1;
    
    await expect(ChaCha20Poly1305.decrypt(ciphertext, tag, params))
      .to.be.rejectedWith('Decryption failed');
  });

  it('should detect modified parameters', async () => {
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(Buffer.from(message), params);
    
    const modifiedParams = {
      ...params,
      key: randomBytes(32)
    };
    
    await expect(ChaCha20Poly1305.decrypt(ciphertext, tag, modifiedParams))
      .to.be.rejectedWith('Decryption failed');
  });

  it('should handle empty message', async () => {
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(Buffer.from(''), params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
    expect(decrypted.length).to.equal(0);
  });

  it('should reject invalid parameters', async () => {
    // Invalid key size
    await expect(ChaCha20Poly1305.encrypt(Buffer.from(message), {
      key: randomBytes(31), // Not 32 bytes
      nonce
    })).to.be.rejectedWith('Invalid key length');

    // Invalid nonce size
    await expect(ChaCha20Poly1305.encrypt(Buffer.from(message), {
      key,
      nonce: randomBytes(11) // Not 12 bytes
    })).to.be.rejectedWith('Invalid nonce length');
  });

  it('should handle different message types', async () => {
    const testCases = [
      'Regular string',
      Buffer.from([0x00, 0xFF, 0x10, 0xAB]), // Binary data
      Buffer.alloc(1024).fill('A'), // Large message
      '', // Empty message
      '🔑🔒' // Unicode string
    ];

    for (const original of testCases) {
      const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(Buffer.from(original), params);
      const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
      expect(decrypted.toString()).to.equal(original);
    }
  });

  it('should be deterministic with same nonce', async () => {
    const fixedNonce = Buffer.alloc(12).fill(0);
    const params1: ChaChaParams = {
      key,
      nonce: fixedNonce
    };

    const params2 = { ...params1 };

    const result1 = await ChaCha20Poly1305.encrypt(Buffer.from(message), params1);
    const result2 = await ChaCha20Poly1305.encrypt(Buffer.from(message), params2);

    expect(result1.ciphertext).to.deep.equal(result2.ciphertext);
    expect(result1.tag).to.deep.equal(result2.tag);
  });

  it('should handle large data efficiently', async () => {
    const largeData = randomBytes(1024 * 1024); // 1MB
    const { ciphertext, tag } = await ChaCha20Poly1305.encrypt(largeData, params);
    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
    expect(decrypted).to.deep.equal(largeData);
  });

  it('should support streaming encryption', async () => {
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    const chacha = new ChaCha20Poly1305(params);
    let ciphertext = Buffer.alloc(0);
    for (const chunk of chunks) {
      ciphertext = Buffer.concat([ciphertext, await chacha.update(chunk)]);
    }
    const { finalCiphertext, tag } = await chacha.final();
    ciphertext = Buffer.concat([ciphertext, finalCiphertext]);

    const decrypted = await ChaCha20Poly1305.decrypt(ciphertext, tag, params);
    expect(decrypted.toString()).to.equal(chunks.map(c => c.toString()).join(''));
  });
}); 