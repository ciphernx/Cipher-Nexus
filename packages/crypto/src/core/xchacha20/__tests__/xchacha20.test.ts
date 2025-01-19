import { XChaCha20 } from '../xchacha20';
import { randomBytes } from 'crypto';

describe('XChaCha20 Stream Cipher', () => {
  const key = randomBytes(32); // 256-bit key
  const nonce = randomBytes(24); // 192-bit nonce
  const plaintext = Buffer.from('Hello, XChaCha20!');
  const additionalData = Buffer.from('additional data');

  it('should encrypt and decrypt correctly', () => {
    const cipher = new XChaCha20(key);
    
    // Encrypt
    const ciphertext = cipher.encrypt(plaintext, nonce);
    expect(ciphertext).not.toEqual(plaintext);
    expect(ciphertext.length).toBe(plaintext.length);

    // Decrypt
    const decrypted = cipher.decrypt(ciphertext, nonce);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertexts with different nonces', () => {
    const cipher = new XChaCha20(key);
    const nonce1 = randomBytes(24);
    const nonce2 = randomBytes(24);

    const ciphertext1 = cipher.encrypt(plaintext, nonce1);
    const ciphertext2 = cipher.encrypt(plaintext, nonce2);

    expect(ciphertext1).not.toEqual(ciphertext2);
  });

  it('should support authenticated encryption with Poly1305', () => {
    const cipher = new XChaCha20(key);
    
    // Encrypt and authenticate
    const { ciphertext, tag } = cipher.encryptWithPoly1305(plaintext, nonce, additionalData);
    expect(tag.length).toBe(16); // 128-bit authentication tag

    // Verify and decrypt
    const decrypted = cipher.decryptWithPoly1305(ciphertext, nonce, tag, additionalData);
    expect(decrypted).toEqual(plaintext);
  });

  it('should detect tampering in authenticated mode', () => {
    const cipher = new XChaCha20(key);
    
    // Encrypt and authenticate
    const { ciphertext, tag } = cipher.encryptWithPoly1305(plaintext, nonce, additionalData);

    // Tamper with ciphertext
    ciphertext[0] ^= 1;

    // Should fail to decrypt
    expect(() => {
      cipher.decryptWithPoly1305(ciphertext, nonce, tag, additionalData);
    }).toThrow('authentication failed');
  });

  it('should detect tampering with additional data', () => {
    const cipher = new XChaCha20(key);
    
    // Encrypt and authenticate
    const { ciphertext, tag } = cipher.encryptWithPoly1305(plaintext, nonce, additionalData);

    // Tamper with additional data
    const tamperedAD = Buffer.from(additionalData);
    tamperedAD[0] ^= 1;

    // Should fail to decrypt
    expect(() => {
      cipher.decryptWithPoly1305(ciphertext, nonce, tag, tamperedAD);
    }).toThrow('authentication failed');
  });

  it('should support streaming encryption', () => {
    const cipher = new XChaCha20(key);
    const stream = cipher.createEncryptStream(nonce);
    
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    const encrypted = chunks.map(chunk => stream.update(chunk));
    const final = stream.final();
    if (final.length > 0) encrypted.push(final);

    const decryptStream = cipher.createDecryptStream(nonce);
    const decrypted = encrypted.map(chunk => decryptStream.update(chunk));
    const finalDecrypted = decryptStream.final();
    if (finalDecrypted.length > 0) decrypted.push(finalDecrypted);

    expect(Buffer.concat(decrypted)).toEqual(Buffer.concat(chunks));
  });

  it('should support seeking', () => {
    const cipher = new XChaCha20(key);
    const largeData = randomBytes(1024 * 1024); // 1MB
    
    // Encrypt full data
    const fullCiphertext = cipher.encrypt(largeData, nonce);

    // Encrypt with seeking
    const position = 1024; // 1KB offset
    cipher.seek(position, nonce);
    const partialCiphertext = cipher.encrypt(
      largeData.slice(position),
      nonce
    );

    // Compare partial encryption with full encryption
    expect(partialCiphertext).toEqual(
      fullCiphertext.slice(position)
    );
  });

  it('should handle empty messages', () => {
    const cipher = new XChaCha20(key);
    const emptyData = Buffer.alloc(0);

    const ciphertext = cipher.encrypt(emptyData, nonce);
    expect(ciphertext.length).toBe(0);

    const decrypted = cipher.decrypt(ciphertext, nonce);
    expect(decrypted.length).toBe(0);
  });

  it('should handle large messages', () => {
    const cipher = new XChaCha20(key);
    const largeData = randomBytes(1024 * 1024); // 1MB

    const ciphertext = cipher.encrypt(largeData, nonce);
    const decrypted = cipher.decrypt(ciphertext, nonce);

    expect(decrypted).toEqual(largeData);
  });

  it('should support test vectors', () => {
    // Test vectors from draft-irtf-cfrg-xchacha
    const testVector = {
      key: Buffer.from('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f', 'hex'),
      nonce: Buffer.from('404142434445464748494a4b4c4d4e4f5051525354555657', 'hex'),
      plaintext: Buffer.from('4c616469657320616e642047656e746c656d656e206f662074686520636c617373206f66202739393a204966204920636f756c64206f6666657220796f75206f6e6c79206f6e652074697020666f7220746865206675747572652c2073756e73637265656e20776f756c642062652069742e', 'hex'),
      ciphertext: Buffer.from('bd6d179d3e83d43b9576579493c0e939572a1700252bfaccbed2902c21396cbb731c7f1b0b4aa6440bf3a82f4eda7e39ae64c6708c54c216cb96b72e1213b4522f8c9ba40db5d945b11b69b982c1bb9e3f3fac2bc369488f76b2383565d3fff921f9664c97637da9768812f615c68b13b52e', 'hex')
    };

    const cipher = new XChaCha20(testVector.key);
    const ciphertext = cipher.encrypt(testVector.plaintext, testVector.nonce);
    expect(ciphertext).toEqual(testVector.ciphertext);

    const decrypted = cipher.decrypt(ciphertext, testVector.nonce);
    expect(decrypted).toEqual(testVector.plaintext);
  });

  it('should reject invalid inputs', () => {
    // Invalid key size
    expect(() => {
      new XChaCha20(randomBytes(31));
    }).toThrow('invalid key size');

    const cipher = new XChaCha20(key);

    // Invalid nonce size
    expect(() => {
      cipher.encrypt(plaintext, randomBytes(23));
    }).toThrow('invalid nonce size');

    // Counter overflow
    const maxCounter = BigInt(2 ** 32 - 1);
    expect(() => {
      cipher.encryptWithCounter(plaintext, nonce, maxCounter + 1n);
    }).toThrow('counter overflow');
  });

  it('should support subkey derivation', () => {
    const cipher = new XChaCha20(key);
    
    // Derive subkey using HChaCha20
    const subkey = cipher.deriveSubkey(nonce.slice(0, 16));
    expect(subkey.length).toBe(32);

    // Subkey should be deterministic
    const subkey2 = cipher.deriveSubkey(nonce.slice(0, 16));
    expect(subkey).toEqual(subkey2);

    // Different inputs should produce different subkeys
    const differentSubkey = cipher.deriveSubkey(randomBytes(16));
    expect(subkey).not.toEqual(differentSubkey);
  });
}); 