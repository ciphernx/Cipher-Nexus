import { Ed25519 } from '../ed25519';
import { randomBytes } from 'crypto';

describe('Ed25519 Digital Signatures', () => {
  const message = Buffer.from('Hello, Ed25519!');

  it('should generate valid key pairs', () => {
    const keyPair = Ed25519.generateKeyPair();
    
    expect(keyPair.publicKey.length).toBe(32);
    expect(keyPair.secretKey.length).toBe(64); // Ed25519 secret key includes public key
    
    // Public key should be on the curve
    expect(Ed25519.isValidPoint(keyPair.publicKey)).toBe(true);
  });

  it('should sign and verify messages correctly', () => {
    const keyPair = Ed25519.generateKeyPair();
    
    // Sign message
    const signature = Ed25519.sign(message, keyPair.secretKey);
    expect(signature.length).toBe(64);

    // Verify signature
    const isValid = Ed25519.verify(message, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('should generate deterministic signatures', () => {
    const keyPair = Ed25519.generateKeyPair();
    
    // Sign same message twice
    const signature1 = Ed25519.sign(message, keyPair.secretKey);
    const signature2 = Ed25519.sign(message, keyPair.secretKey);

    // Signatures should be identical
    expect(signature1).toEqual(signature2);
  });

  it('should generate different signatures for different messages', () => {
    const keyPair = Ed25519.generateKeyPair();
    const message1 = Buffer.from('First message');
    const message2 = Buffer.from('Second message');

    const signature1 = Ed25519.sign(message1, keyPair.secretKey);
    const signature2 = Ed25519.sign(message2, keyPair.secretKey);

    expect(signature1).not.toEqual(signature2);
  });

  it('should detect modified messages', () => {
    const keyPair = Ed25519.generateKeyPair();
    const signature = Ed25519.sign(message, keyPair.secretKey);

    // Modify message
    const modifiedMessage = Buffer.from(message);
    modifiedMessage[0] ^= 1;

    const isValid = Ed25519.verify(modifiedMessage, signature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should detect modified signatures', () => {
    const keyPair = Ed25519.generateKeyPair();
    const signature = Ed25519.sign(message, keyPair.secretKey);

    // Modify signature
    const modifiedSignature = Buffer.from(signature);
    modifiedSignature[0] ^= 1;

    const isValid = Ed25519.verify(message, modifiedSignature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should handle empty messages', () => {
    const keyPair = Ed25519.generateKeyPair();
    const emptyMessage = Buffer.from('');

    const signature = Ed25519.sign(emptyMessage, keyPair.secretKey);
    const isValid = Ed25519.verify(emptyMessage, signature, keyPair.publicKey);

    expect(isValid).toBe(true);
  });

  it('should handle large messages', () => {
    const keyPair = Ed25519.generateKeyPair();
    const largeMessage = randomBytes(1024 * 1024); // 1MB

    const signature = Ed25519.sign(largeMessage, keyPair.secretKey);
    const isValid = Ed25519.verify(largeMessage, signature, keyPair.publicKey);

    expect(isValid).toBe(true);
  });

  it('should support batch verification', () => {
    const numMessages = 100;
    const messages = Array(numMessages).fill(null).map(() => 
      randomBytes(32)
    );
    const keyPairs = Array(numMessages).fill(null).map(() => 
      Ed25519.generateKeyPair()
    );
    const signatures = messages.map((msg, i) => 
      Ed25519.sign(msg, keyPairs[i].secretKey)
    );

    // Verify all signatures in batch
    const isValid = Ed25519.verifyBatch(
      messages,
      signatures,
      keyPairs.map(kp => kp.publicKey)
    );
    expect(isValid).toBe(true);

    // Modify one message
    messages[0][0] ^= 1;
    const isInvalid = Ed25519.verifyBatch(
      messages,
      signatures,
      keyPairs.map(kp => kp.publicKey)
    );
    expect(isInvalid).toBe(false);
  });

  it('should support context information', () => {
    const keyPair = Ed25519.generateKeyPair();
    const context = Buffer.from('test-context');

    // Sign with context
    const signature = Ed25519.signWithContext(message, keyPair.secretKey, context);

    // Verify with same context
    const isValid = Ed25519.verifyWithContext(
      message,
      signature,
      keyPair.publicKey,
      context
    );
    expect(isValid).toBe(true);

    // Verify with different context should fail
    const differentContext = Buffer.from('different-context');
    const isInvalid = Ed25519.verifyWithContext(
      message,
      signature,
      keyPair.publicKey,
      differentContext
    );
    expect(isInvalid).toBe(false);
  });

  it('should support prehashed messages', () => {
    const keyPair = Ed25519.generateKeyPair();
    const messageHash = Ed25519.prehash(message);

    // Sign prehashed message
    const signature = Ed25519.signPrehashed(messageHash, keyPair.secretKey);

    // Verify prehashed message
    const isValid = Ed25519.verifyPrehashed(messageHash, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('should support test vectors', () => {
    // Test vectors from RFC 8032
    const secretKey = Buffer.from(
      '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
      'hex'
    );
    const publicKey = Buffer.from(
      'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
      'hex'
    );
    const message = Buffer.from('');
    const expectedSignature = Buffer.from(
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
      'hex'
    );

    // Generate key pair from seed
    const keyPair = Ed25519.generateKeyPairFromSeed(secretKey);
    expect(keyPair.publicKey).toEqual(publicKey);

    // Sign and verify
    const signature = Ed25519.sign(message, keyPair.secretKey);
    expect(signature).toEqual(expectedSignature);

    const isValid = Ed25519.verify(message, signature, publicKey);
    expect(isValid).toBe(true);
  });

  it('should handle invalid inputs', () => {
    const keyPair = Ed25519.generateKeyPair();
    const signature = Ed25519.sign(message, keyPair.secretKey);

    // Invalid public key size
    expect(() => {
      Ed25519.verify(message, signature, Buffer.alloc(31));
    }).toThrow();

    // Invalid signature size
    expect(() => {
      Ed25519.verify(message, Buffer.alloc(63), keyPair.publicKey);
    }).toThrow();

    // Invalid secret key size
    expect(() => {
      Ed25519.sign(message, Buffer.alloc(63));
    }).toThrow();
  });

  it('should be time-independent in verification', async () => {
    const keyPair = Ed25519.generateKeyPair();
    const shortMessage = Buffer.from('short');
    const longMessage = Buffer.from('very_long_message_for_timing_test');

    const shortSignature = Ed25519.sign(shortMessage, keyPair.secretKey);
    const longSignature = Ed25519.sign(longMessage, keyPair.secretKey);

    const startShort = process.hrtime.bigint();
    await Ed25519.verify(shortMessage, shortSignature, keyPair.publicKey);
    const endShort = process.hrtime.bigint();

    const startLong = process.hrtime.bigint();
    await Ed25519.verify(longMessage, longSignature, keyPair.publicKey);
    const endLong = process.hrtime.bigint();

    const shortTime = Number(endShort - startShort);
    const longTime = Number(endLong - startLong);

    // Verification time should be constant regardless of message length
    const timeDiff = Math.abs(shortTime - longTime) / Math.max(shortTime, longTime);
    expect(timeDiff).toBeLessThan(0.1);
  });
}); 