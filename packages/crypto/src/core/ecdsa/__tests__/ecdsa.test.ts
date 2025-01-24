import { ECDSA } from '../ecdsa';
import { randomBytes } from 'crypto';

describe('ECDSA Digital Signatures', () => {
  const message = Buffer.from('Hello, ECDSA!');
  const curves = ['secp256k1', 'P-256', 'P-384', 'P-521'];

  it('should generate valid key pairs for different curves', () => {
    for (const curve of curves) {
      const keyPair = ECDSA.generateKeyPair(curve);
      
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.secretKey).toBeDefined();
      
      // Public key should be on the curve
      expect(ECDSA.isValidPoint(keyPair.publicKey, curve)).toBe(true);
    }
  });

  it('should sign and verify messages correctly', () => {
    for (const curve of curves) {
      const keyPair = ECDSA.generateKeyPair(curve);
      
      // Sign message
      const signature = ECDSA.sign(message, keyPair.secretKey, curve);
      expect(signature.r).toBeDefined();
      expect(signature.s).toBeDefined();

      // Verify signature
      const isValid = ECDSA.verify(message, signature, keyPair.publicKey, curve);
      expect(isValid).toBe(true);
    }
  });

  it('should generate different signatures for same message', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    
    // Sign same message twice
    const signature1 = ECDSA.sign(message, keyPair.secretKey, 'secp256k1');
    const signature2 = ECDSA.sign(message, keyPair.secretKey, 'secp256k1');

    // Signatures should be different due to random k
    expect(signature1).not.toEqual(signature2);
    
    // But both should verify
    expect(ECDSA.verify(message, signature1, keyPair.publicKey, 'secp256k1')).toBe(true);
    expect(ECDSA.verify(message, signature2, keyPair.publicKey, 'secp256k1')).toBe(true);
  });

  it('should support deterministic signatures (RFC 6979)', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    
    // Sign same message twice deterministically
    const signature1 = ECDSA.signDeterministic(message, keyPair.secretKey, 'secp256k1');
    const signature2 = ECDSA.signDeterministic(message, keyPair.secretKey, 'secp256k1');

    // Signatures should be identical
    expect(signature1).toEqual(signature2);
    
    // And should verify
    expect(ECDSA.verify(message, signature1, keyPair.publicKey, 'secp256k1')).toBe(true);
  });

  it('should detect modified messages', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const signature = ECDSA.sign(message, keyPair.secretKey, 'secp256k1');

    // Modify message
    const modifiedMessage = Buffer.from(message);
    modifiedMessage[0] ^= 1;

    const isValid = ECDSA.verify(modifiedMessage, signature, keyPair.publicKey, 'secp256k1');
    expect(isValid).toBe(false);
  });

  it('should detect modified signatures', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const signature = ECDSA.sign(message, keyPair.secretKey, 'secp256k1');

    // Modify signature
    const modifiedSignature = { ...signature, r: signature.r + 1n };

    const isValid = ECDSA.verify(message, modifiedSignature, keyPair.publicKey, 'secp256k1');
    expect(isValid).toBe(false);
  });

  it('should handle empty messages', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const emptyMessage = Buffer.from('');

    const signature = ECDSA.sign(emptyMessage, keyPair.secretKey, 'secp256k1');
    const isValid = ECDSA.verify(emptyMessage, signature, keyPair.publicKey, 'secp256k1');

    expect(isValid).toBe(true);
  });

  it('should handle large messages', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const signature = ECDSA.sign(largeMessage, keyPair.secretKey, 'secp256k1');
    const isValid = ECDSA.verify(largeMessage, signature, keyPair.publicKey, 'secp256k1');

    expect(isValid).toBe(true);
  });

  it('should support batch verification', () => {
    const numMessages = 100;
    const messages = Array(numMessages).fill(null).map(() => 
      randomBytes(32)
    );
    const keyPairs = Array(numMessages).fill(null).map(() => 
      ECDSA.generateKeyPair('secp256k1')
    );
    const signatures = messages.map((msg, i) => 
      ECDSA.sign(msg, keyPairs[i].secretKey, 'secp256k1')
    );

    // Verify all signatures in batch
    const isValid = ECDSA.verifyBatch(
      messages,
      signatures,
      keyPairs.map(kp => kp.publicKey),
      'secp256k1'
    );
    expect(isValid).toBe(true);

    // Modify one message
    messages[0][0] ^= 1;
    const isInvalid = ECDSA.verifyBatch(
      messages,
      signatures,
      keyPairs.map(kp => kp.publicKey),
      'secp256k1'
    );
    expect(isInvalid).toBe(false);
  });

  it('should support test vectors', () => {
    // Test vectors from NIST CAVP
    const testVector = {
      curve: 'P-256',
      secretKey: Buffer.from('c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721', 'hex'),
      publicKey: {
        x: Buffer.from('60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6', 'hex'),
        y: Buffer.from('7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299', 'hex')
      },
      message: Buffer.from('sample', 'utf8'),
      signature: {
        r: BigInt('0xefd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716'),
        s: BigInt('0xf7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8')
      }
    };

    // Verify test vector
    const isValid = ECDSA.verify(
      testVector.message,
      testVector.signature,
      testVector.publicKey,
      testVector.curve
    );
    expect(isValid).toBe(true);
  });

  it('should handle invalid inputs', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const signature = ECDSA.sign(message, keyPair.secretKey, 'secp256k1');

    // Invalid curve
    expect(() => {
      ECDSA.generateKeyPair('invalid-curve');
    }).toThrow();

    // Invalid public key
    expect(() => {
      ECDSA.verify(message, signature, { x: 0n, y: 0n }, 'secp256k1');
    }).toThrow();

    // Invalid signature values
    expect(() => {
      ECDSA.verify(message, { r: 0n, s: 0n }, keyPair.publicKey, 'secp256k1');
    }).toThrow();
  });

  it('should be time-independent in verification', async () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const shortMessage = Buffer.from('short');
    const longMessage = Buffer.from('very_long_message_for_timing_test');

    const shortSignature = ECDSA.sign(shortMessage, keyPair.secretKey, 'secp256k1');
    const longSignature = ECDSA.sign(longMessage, keyPair.secretKey, 'secp256k1');

    const startShort = process.hrtime.bigint();
    await ECDSA.verify(shortMessage, shortSignature, keyPair.publicKey, 'secp256k1');
    const endShort = process.hrtime.bigint();

    const startLong = process.hrtime.bigint();
    await ECDSA.verify(longMessage, longSignature, keyPair.publicKey, 'secp256k1');
    const endLong = process.hrtime.bigint();

    const shortTime = Number(endShort - startShort);
    const longTime = Number(endLong - startLong);

    // Verification time should be constant regardless of message length
    const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
    expect(timeDiff).toBeLessThan(0.1);
  });

  it('should support custom hash functions', () => {
    const keyPair = ECDSA.generateKeyPair('secp256k1');
    const hashAlgos = ['SHA-256', 'SHA-384', 'SHA-512'];

    for (const hashAlgo of hashAlgos) {
      const signature = ECDSA.sign(message, keyPair.secretKey, 'secp256k1', { hashAlgo });
      const isValid = ECDSA.verify(message, signature, keyPair.publicKey, 'secp256k1', { hashAlgo });
      expect(isValid).toBe(true);
    }
  });
}); 