import { SHA2, SHA2Variant } from '../sha2';
import { randomBytes } from 'crypto';

describe('SHA-2 Hash Functions', () => {
  const message = 'Hello, SHA-2!';
  const variants = [
    SHA2Variant.SHA224,
    SHA2Variant.SHA256,
    SHA2Variant.SHA384,
    SHA2Variant.SHA512,
    SHA2Variant.SHA512_224,
    SHA2Variant.SHA512_256
  ];

  it('should generate correct hash lengths', () => {
    const lengths = {
      [SHA2Variant.SHA224]: 28,    // 224 bits = 28 bytes
      [SHA2Variant.SHA256]: 32,    // 256 bits = 32 bytes
      [SHA2Variant.SHA384]: 48,    // 384 bits = 48 bytes
      [SHA2Variant.SHA512]: 64,    // 512 bits = 64 bytes
      [SHA2Variant.SHA512_224]: 28, // 224 bits = 28 bytes
      [SHA2Variant.SHA512_256]: 32  // 256 bits = 32 bytes
    };

    for (const variant of variants) {
      const hash = SHA2.hash(Buffer.from(message), variant);
      expect(hash.length).toBe(lengths[variant]);
    }
  });

  it('should be deterministic', () => {
    for (const variant of variants) {
      const hash1 = SHA2.hash(Buffer.from(message), variant);
      const hash2 = SHA2.hash(Buffer.from(message), variant);
      expect(hash1).toEqual(hash2);
    }
  });

  it('should produce different hashes for different messages', () => {
    const message2 = message + '!';
    
    for (const variant of variants) {
      const hash1 = SHA2.hash(Buffer.from(message), variant);
      const hash2 = SHA2.hash(Buffer.from(message2), variant);
      expect(hash1).not.toEqual(hash2);
    }
  });

  it('should handle empty messages', () => {
    for (const variant of variants) {
      const hash = SHA2.hash(Buffer.from(''), variant);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    }
  });

  it('should handle large messages', () => {
    const largeMessage = randomBytes(1024 * 1024); // 1MB
    
    for (const variant of variants) {
      const hash = SHA2.hash(largeMessage, variant);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    }
  });

  it('should support streaming interface', async () => {
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    for (const variant of variants) {
      // Single-pass hash
      const fullMessage = Buffer.concat(chunks);
      const expectedHash = SHA2.hash(fullMessage, variant);

      // Streaming hash
      const hasher = new SHA2.Streaming(variant);
      for (const chunk of chunks) {
        await hasher.update(chunk);
      }
      const streamingHash = await hasher.finalize();

      expect(streamingHash).toEqual(expectedHash);
    }
  });

  it('should support HMAC', () => {
    const key = randomBytes(32);
    
    for (const variant of variants) {
      const hmac1 = SHA2.hmac(Buffer.from(message), key, variant);
      const hmac2 = SHA2.hmac(Buffer.from(message), key, variant);
      
      // HMAC should be deterministic
      expect(hmac1).toEqual(hmac2);
      
      // HMAC should be different from regular hash
      const hash = SHA2.hash(Buffer.from(message), variant);
      expect(hmac1).not.toEqual(hash);
      
      // Different keys should produce different HMACs
      const differentKey = randomBytes(32);
      const hmac3 = SHA2.hmac(Buffer.from(message), differentKey, variant);
      expect(hmac1).not.toEqual(hmac3);
    }
  });

  it('should handle different key sizes in HMAC', () => {
    const keySizes = [16, 32, 64, 128]; // Different key sizes in bytes
    
    for (const variant of variants) {
      for (const keySize of keySizes) {
        const key = randomBytes(keySize);
        const hmac = SHA2.hmac(Buffer.from(message), key, variant);
        expect(hmac).toBeDefined();
        expect(hmac.length).toBeGreaterThan(0);
      }
    }
  });

  it('should support streaming HMAC', async () => {
    const key = randomBytes(32);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    for (const variant of variants) {
      // Single-pass HMAC
      const fullMessage = Buffer.concat(chunks);
      const expectedHmac = SHA2.hmac(fullMessage, key, variant);

      // Streaming HMAC
      const hmac = new SHA2.StreamingHMAC(key, variant);
      for (const chunk of chunks) {
        await hmac.update(chunk);
      }
      const streamingHmac = await hmac.finalize();

      expect(streamingHmac).toEqual(expectedHmac);
    }
  });

  it('should be collision resistant', () => {
    // Test with similar messages
    const similarMessages = [
      'message',
      'messafe',
      'Message',
      'message ',
      ' message'
    ];

    for (const variant of variants) {
      const hashes = new Set();
      for (const msg of similarMessages) {
        const hash = SHA2.hash(Buffer.from(msg), variant);
        hashes.add(hash.toString('hex'));
      }
      // All hashes should be different
      expect(hashes.size).toBe(similarMessages.length);
    }
  });

  it('should exhibit avalanche effect', () => {
    const message1 = randomBytes(64);
    const message2 = Buffer.from(message1);
    // Change a single bit
    message2[0] ^= 1;

    for (const variant of variants) {
      const hash1 = SHA2.hash(message1, variant);
      const hash2 = SHA2.hash(message2, variant);

      // Count differing bits
      let differingBits = 0;
      for (let i = 0; i < hash1.length; i++) {
        const xor = hash1[i] ^ hash2[i];
        differingBits += countBits(xor);
      }

      // On average, half of the bits should be different
      const totalBits = hash1.length * 8;
      const diffPercentage = (differingBits / totalBits) * 100;
      expect(diffPercentage).toBeGreaterThan(45); // Allow some variance
      expect(diffPercentage).toBeLessThan(55);
    }
  });
});

// Helper function to count bits in a byte
function countBits(byte: number): number {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    if ((byte & (1 << i)) !== 0) {
      count++;
    }
  }
  return count;
} 