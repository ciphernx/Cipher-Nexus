import { expect } from 'chai';
import { XChaCha20 } from '../xchacha20';
import { randomBytes } from 'crypto';

describe('XChaCha20', () => {
  let key: Buffer;
  let nonce: Buffer;

  beforeEach(() => {
    key = Buffer.alloc(32);
    nonce = Buffer.alloc(24);
    randomBytes(32).copy(key);
    randomBytes(24).copy(nonce);
  });

  it('should encrypt and decrypt data correctly', () => {
    const plaintext = Buffer.from('Hello, XChaCha20!');
    const ciphertext = XChaCha20.encrypt(plaintext, key, nonce);
    const decrypted = XChaCha20.decrypt(ciphertext, key, nonce);
    expect(decrypted.toString()).to.equal(plaintext.toString());
  });

  it('should handle empty messages', () => {
    const plaintext = Buffer.from('');
    const ciphertext = XChaCha20.encrypt(plaintext, key, nonce);
    const decrypted = XChaCha20.decrypt(ciphertext, key, nonce);
    expect(decrypted.toString()).to.equal(plaintext.toString());
  });

  it('should handle large messages', () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB
    randomBytes(1024 * 1024).copy(plaintext);
    const ciphertext = XChaCha20.encrypt(plaintext, key, nonce);
    const decrypted = XChaCha20.decrypt(ciphertext, key, nonce);
    expect(decrypted.toString('hex')).to.equal(plaintext.toString('hex'));
  });

  it('should reject invalid key sizes', () => {
    const invalidKey = Buffer.alloc(16); // Too small
    const plaintext = Buffer.from('test');
    expect(() => XChaCha20.encrypt(plaintext, invalidKey, nonce)).to.throw();
  });

  it('should reject invalid nonce sizes', () => {
    const invalidNonce = Buffer.alloc(12); // Too small
    const plaintext = Buffer.from('test');
    expect(() => XChaCha20.encrypt(plaintext, key, invalidNonce)).to.throw();
  });

  it('should produce different ciphertexts for same plaintext with different nonces', () => {
    const plaintext = Buffer.from('Hello, XChaCha20!');
    const nonce1 = Buffer.alloc(24);
    const nonce2 = Buffer.alloc(24);
    randomBytes(24).copy(nonce1);
    randomBytes(24).copy(nonce2);

    const ciphertext1 = XChaCha20.encrypt(plaintext, key, nonce1);
    const ciphertext2 = XChaCha20.encrypt(plaintext, key, nonce2);

    expect(ciphertext1.toString('hex')).to.not.equal(ciphertext2.toString('hex'));
  });

  it('should support authenticated encryption', () => {
    const plaintext = Buffer.from('Hello, XChaCha20!');
    const aad = Buffer.from('Additional data');
    
    const { ciphertext, tag } = XChaCha20.encryptWithAEAD(plaintext, key, nonce, aad);
    const decrypted = XChaCha20.decryptWithAEAD(ciphertext, key, nonce, tag, aad);
    
    expect(decrypted.toString()).to.equal(plaintext.toString());
  });

  it('should detect tampering in authenticated mode', () => {
    const plaintext = Buffer.from('Hello, XChaCha20!');
    const aad = Buffer.from('Additional data');
    
    const { ciphertext, tag } = XChaCha20.encryptWithAEAD(plaintext, key, nonce, aad);
    
    // Tamper with ciphertext
    ciphertext[0] ^= 1;
    
    expect(() => XChaCha20.decryptWithAEAD(ciphertext, key, nonce, tag, aad)).to.throw();
  });

  it('should support streaming encryption', () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB
    randomBytes(1024 * 1024).copy(plaintext);
    
    const chunkSize = 1024;
    const encryptedChunks: Buffer[] = [];
    
    for (let i = 0; i < plaintext.length; i += chunkSize) {
      const chunk = plaintext.slice(i, i + chunkSize);
      const encryptedChunk = XChaCha20.encrypt(chunk, key, nonce, BigInt(i));
      encryptedChunks.push(encryptedChunk);
    }
    
    const decryptedChunks: Buffer[] = [];
    for (let i = 0; i < encryptedChunks.length; i++) {
      const decryptedChunk = XChaCha20.decrypt(encryptedChunks[i], key, nonce, BigInt(i * chunkSize));
      decryptedChunks.push(decryptedChunk);
    }
    
    const decrypted = Buffer.concat(decryptedChunks);
    expect(decrypted.toString('hex')).to.equal(plaintext.toString('hex'));
  });

  it('should support seeking', () => {
    const plaintext = Buffer.alloc(1024 * 1024); // 1MB
    randomBytes(1024 * 1024).copy(plaintext);
    
    const ciphertext = XChaCha20.encrypt(plaintext, key, nonce);
    
    // Decrypt from middle
    const offset = 512 * 1024;
    const decryptedPart = XChaCha20.decrypt(
      ciphertext.slice(offset),
      key,
      nonce,
      BigInt(offset)
    );
    
    expect(decryptedPart.toString('hex')).to.equal(plaintext.slice(offset).toString('hex'));
  });

  it('should derive subkeys correctly', () => {
    const subkey = XChaCha20.deriveSubkey(key, nonce);
    expect(subkey.length).to.equal(32);
    
    // Subkey should be deterministic
    const subkey2 = XChaCha20.deriveSubkey(key, nonce);
    expect(subkey.toString('hex')).to.equal(subkey2.toString('hex'));
    
    // Different nonce should produce different subkey
    const nonce2 = Buffer.alloc(24);
    randomBytes(24).copy(nonce2);
    const subkey3 = XChaCha20.deriveSubkey(key, nonce2);
    expect(subkey.toString('hex')).to.not.equal(subkey3.toString('hex'));
  });
}); 