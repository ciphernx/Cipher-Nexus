import { expect } from 'chai';
import { RecordLayer } from '../record-layer';
import { randomBytes } from 'crypto';

describe('TLS Record Layer', () => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  let recordLayer: RecordLayer;

  beforeEach(() => {
    recordLayer = new RecordLayer({
      key,
      iv,
      maxRecordSize: 16384
    });
  });

  it('should encrypt and decrypt application data', () => {
    const plaintext = Buffer.from('Hello, TLS!');
    const additionalData = Buffer.from('additional data');

    const ciphertext = recordLayer.encrypt(plaintext, additionalData);
    const decrypted = recordLayer.decrypt(ciphertext, additionalData);

    expect(decrypted).to.deep.equal(plaintext);
  });

  it('should reject records exceeding maximum size', () => {
    const plaintext = randomBytes(16385); // Exceeds maxRecordSize
    const additionalData = Buffer.from('additional data');

    expect(() => recordLayer.encrypt(plaintext, additionalData)).to.throw();
  });

  it('should reject records with invalid key size', () => {
    const invalidKey = randomBytes(16); // Invalid key size
    expect(() => new RecordLayer({ key: invalidKey, iv })).to.throw();
  });

  it('should reject records with invalid IV size', () => {
    const invalidIV = randomBytes(8); // Invalid IV size
    expect(() => new RecordLayer({ key, iv: invalidIV })).to.throw();
  });

  it('should detect tampering with ciphertext', () => {
    const plaintext = Buffer.from('Hello, TLS!');
    const additionalData = Buffer.from('additional data');

    const ciphertext = recordLayer.encrypt(plaintext, additionalData);
    ciphertext[0] ^= 1; // Tamper with first byte

    expect(() => recordLayer.decrypt(ciphertext, additionalData)).to.throw();
  });

  it('should detect tampering with additional data', () => {
    const plaintext = Buffer.from('Hello, TLS!');
    const additionalData = Buffer.from('additional data');

    const ciphertext = recordLayer.encrypt(plaintext, additionalData);
    const tamperedData = Buffer.from('tampered data');

    expect(() => recordLayer.decrypt(ciphertext, tamperedData)).to.throw();
  });

  it('should handle empty records', () => {
    const plaintext = Buffer.alloc(0);
    const additionalData = Buffer.from('additional data');

    const ciphertext = recordLayer.encrypt(plaintext, additionalData);
    const decrypted = recordLayer.decrypt(ciphertext, additionalData);

    expect(decrypted).to.deep.equal(plaintext);
  });

  it('should handle large records', () => {
    const plaintext = randomBytes(16384); // Maximum allowed size
    const additionalData = Buffer.from('additional data');

    const ciphertext = recordLayer.encrypt(plaintext, additionalData);
    const decrypted = recordLayer.decrypt(ciphertext, additionalData);

    expect(decrypted).to.deep.equal(plaintext);
  });

  it('should increment sequence number', () => {
    const plaintext = Buffer.from('Hello, TLS!');
    const additionalData = Buffer.from('additional data');

    // First encryption
    const ciphertext1 = recordLayer.encrypt(plaintext, additionalData);
    const decrypted1 = recordLayer.decrypt(ciphertext1, additionalData);
    expect(decrypted1).to.deep.equal(plaintext);

    // Second encryption should use different sequence number
    const ciphertext2 = recordLayer.encrypt(plaintext, additionalData);
    expect(ciphertext2).to.not.deep.equal(ciphertext1);

    const decrypted2 = recordLayer.decrypt(ciphertext2, additionalData);
    expect(decrypted2).to.deep.equal(plaintext);
  });

  it('should support custom options', () => {
    const customRecordLayer = new RecordLayer({
      key,
      iv,
      maxRecordSize: 8192, // Custom max size
      keySize: 32,
      ivSize: 12
    });

    const plaintext = randomBytes(8192);
    const additionalData = Buffer.from('additional data');

    const ciphertext = customRecordLayer.encrypt(plaintext, additionalData);
    const decrypted = customRecordLayer.decrypt(ciphertext, additionalData);

    expect(decrypted).to.deep.equal(plaintext);
  });

  it('should maintain record boundaries', () => {
    const record1 = Buffer.from('First record');
    const record2 = Buffer.from('Second record');
    const additionalData = Buffer.from('additional data');

    const ciphertext1 = recordLayer.encrypt(record1, additionalData);
    const ciphertext2 = recordLayer.encrypt(record2, additionalData);

    const decrypted1 = recordLayer.decrypt(ciphertext1, additionalData);
    const decrypted2 = recordLayer.decrypt(ciphertext2, additionalData);

    expect(decrypted1).to.deep.equal(record1);
    expect(decrypted2).to.deep.equal(record2);
  });
}); 