import { Blake2, Blake2Variant } from '../blake2';
import { randomBytes } from 'crypto';

describe('Blake2 Hash Functions', () => {
  const message = 'Hello, Blake2!';
  const variants = [
    Blake2Variant.BLAKE2B_256,
    Blake2Variant.BLAKE2B_384,
    Blake2Variant.BLAKE2B_512,
    Blake2Variant.BLAKE2S_128,
    Blake2Variant.BLAKE2S_256
  ];

  it('should generate correct hash lengths', () => {
    const lengths = {
      [Blake2Variant.BLAKE2B_256]: 32,  // 256 bits = 32 bytes
      [Blake2Variant.BLAKE2B_384]: 48,  // 384 bits = 48 bytes
      [Blake2Variant.BLAKE2B_512]: 64,  // 512 bits = 64 bytes
      [Blake2Variant.BLAKE2S_128]: 16,  // 128 bits = 16 bytes
      [Blake2Variant.BLAKE2S_256]: 32   // 256 bits = 32 bytes
    };

    for (const variant of variants) {
      const hash = Blake2.hash(Buffer.from(message), variant);
      expect(hash.length).toBe(lengths[variant]);
    }
  });

  it('should support variable output length', () => {
    const outputLengths = [16, 32, 48, 64]; // Different output lengths in bytes

    for (const length of outputLengths) {
      // Blake2b supports any output length up to 64 bytes
      const hashB = Blake2.hash(Buffer.from(message), Blake2Variant.BLAKE2B_512, length);
      expect(hashB.length).toBe(length);

      // Blake2s supports any output length up to 32 bytes
      if (length <= 32) {
        const hashS = Blake2.hash(Buffer.from(message), Blake2Variant.BLAKE2S_256, length);
        expect(hashS.length).toBe(length);
      }
    }
  });

  it('should be deterministic', () => {
    for (const variant of variants) {
      const hash1 = Blake2.hash(Buffer.from(message), variant);
      const hash2 = Blake2.hash(Buffer.from(message), variant);
      expect(hash1).toEqual(hash2);
    }
  });

  it('should produce different hashes for different messages', () => {
    const message2 = message + '!';
    
    for (const variant of variants) {
      const hash1 = Blake2.hash(Buffer.from(message), variant);
      const hash2 = Blake2.hash(Buffer.from(message2), variant);
      expect(hash1).not.toEqual(hash2);
    }
  });

  it('should handle empty messages', () => {
    for (const variant of variants) {
      const hash = Blake2.hash(Buffer.from(''), variant);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    }
  });

  it('should handle large messages', () => {
    const largeMessage = randomBytes(1024 * 1024); // 1MB
    
    for (const variant of variants) {
      const hash = Blake2.hash(largeMessage, variant);
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
      const expectedHash = Blake2.hash(fullMessage, variant);

      // Streaming hash
      const hasher = new Blake2.Streaming(variant);
      for (const chunk of chunks) {
        await hasher.update(chunk);
      }
      const streamingHash = await hasher.finalize();

      expect(streamingHash).toEqual(expectedHash);
    }
  });

  it('should support keyed hashing', () => {
    const key = randomBytes(32);
    
    for (const variant of variants) {
      const hash1 = Blake2.keyed(Buffer.from(message), key, variant);
      const hash2 = Blake2.keyed(Buffer.from(message), key, variant);
      
      // Keyed hash should be deterministic
      expect(hash1).toEqual(hash2);
      
      // Keyed hash should be different from regular hash
      const hash = Blake2.hash(Buffer.from(message), variant);
      expect(hash1).not.toEqual(hash);
      
      // Different keys should produce different hashes
      const differentKey = randomBytes(32);
      const hash3 = Blake2.keyed(Buffer.from(message), differentKey, variant);
      expect(hash1).not.toEqual(hash3);
    }
  });

  it('should support different key sizes', () => {
    const keySizes = [16, 32, 48, 64]; // Different key sizes in bytes
    
    for (const variant of variants) {
      for (const keySize of keySizes) {
        const key = randomBytes(keySize);
        const hash = Blake2.keyed(Buffer.from(message), key, variant);
        expect(hash).toBeDefined();
        expect(hash.length).toBeGreaterThan(0);
      }
    }
  });

  it('should support streaming keyed hashing', async () => {
    const key = randomBytes(32);
    const chunks = [
      Buffer.from('First chunk'),
      Buffer.from('Second chunk'),
      Buffer.from('Third chunk')
    ];

    for (const variant of variants) {
      // Single-pass keyed hash
      const fullMessage = Buffer.concat(chunks);
      const expectedHash = Blake2.keyed(fullMessage, key, variant);

      // Streaming keyed hash
      const hasher = new Blake2.StreamingKeyed(key, variant);
      for (const chunk of chunks) {
        await hasher.update(chunk);
      }
      const streamingHash = await hasher.finalize();

      expect(streamingHash).toEqual(expectedHash);
    }
  });

  it('should support personalization', () => {
    const personalization = 'MyApp';
    const salt = randomBytes(16);
    
    for (const variant of variants) {
      const hash1 = Blake2.personalized(Buffer.from(message), personalization, salt, variant);
      const hash2 = Blake2.personalized(Buffer.from(message), personalization, salt, variant);
      
      // Personalized hash should be deterministic
      expect(hash1).toEqual(hash2);
      
      // Different personalization should produce different hashes
      const differentPersonalization = 'DifferentApp';
      const hash3 = Blake2.personalized(Buffer.from(message), differentPersonalization, salt, variant);
      expect(hash1).not.toEqual(hash3);
      
      // Different salt should produce different hashes
      const differentSalt = randomBytes(16);
      const hash4 = Blake2.personalized(Buffer.from(message), personalization, differentSalt, variant);
      expect(hash1).not.toEqual(hash4);
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
        const hash = Blake2.hash(Buffer.from(msg), variant);
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
      const hash1 = Blake2.hash(message1, variant);
      const hash2 = Blake2.hash(message2, variant);

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

  it('should handle tree hashing mode', () => {
    const fanout = 2;
    const depth = 2;
    const leafSize = 4096;
    const innerSize = 64;
    
    const data = randomBytes(leafSize * 4); // Create enough data for a small tree
    
    for (const variant of variants) {
      const hash1 = Blake2.tree(data, fanout, depth, leafSize, innerSize, variant);
      const hash2 = Blake2.tree(data, fanout, depth, leafSize, innerSize, variant);
      
      // Tree hash should be deterministic
      expect(hash1).toEqual(hash2);
      
      // Tree hash should be different from regular hash
      const hash = Blake2.hash(data, variant);
      expect(hash1).not.toEqual(hash);
      
      // Different tree parameters should produce different hashes
      const hash3 = Blake2.tree(data, fanout + 1, depth, leafSize, innerSize, variant);
      expect(hash1).not.toEqual(hash3);
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