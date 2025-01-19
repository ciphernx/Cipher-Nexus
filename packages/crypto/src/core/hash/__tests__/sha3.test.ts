import { SHA3, SHA3Variant, KeccakMode } from '../sha3';
import { randomBytes } from 'crypto';

describe('SHA-3 Hash Functions', () => {
  const message = 'Hello, SHA-3!';
  const variants = [
    SHA3Variant.SHA3_224,
    SHA3Variant.SHA3_256,
    SHA3Variant.SHA3_384,
    SHA3Variant.SHA3_512,
    SHA3Variant.SHAKE128,
    SHA3Variant.SHAKE256
  ];

  it('should generate correct hash lengths', () => {
    const lengths = {
      [SHA3Variant.SHA3_224]: 28,    // 224 bits = 28 bytes
      [SHA3Variant.SHA3_256]: 32,    // 256 bits = 32 bytes
      [SHA3Variant.SHA3_384]: 48,    // 384 bits = 48 bytes
      [SHA3Variant.SHA3_512]: 64,    // 512 bits = 64 bytes
      [SHA3Variant.SHAKE128]: 32,    // Default output length for SHAKE
      [SHA3Variant.SHAKE256]: 64     // Default output length for SHAKE
    };

    for (const variant of variants) {
      const hash = SHA3.hash(Buffer.from(message), variant);
      expect(hash.length).toBe(lengths[variant]);
    }
  });

  it('should support variable output length for SHAKE', () => {
    const outputLengths = [16, 32, 64, 128]; // Different output lengths in bytes

    for (const length of outputLengths) {
      const hash128 = SHA3.hash(Buffer.from(message), SHA3Variant.SHAKE128, length);
      const hash256 = SHA3.hash(Buffer.from(message), SHA3Variant.SHAKE256, length);

      expect(hash128.length).toBe(length);
      expect(hash256.length).toBe(length);
    }
  });

  it('should be deterministic', () => {
    for (const variant of variants) {
      const hash1 = SHA3.hash(Buffer.from(message), variant);
      const hash2 = SHA3.hash(Buffer.from(message), variant);
      expect(hash1).toEqual(hash2);
    }
  });

  it('should produce different hashes for different messages', () => {
    const message2 = message + '!';
    
    for (const variant of variants) {
      const hash1 = SHA3.hash(Buffer.from(message), variant);
      const hash2 = SHA3.hash(Buffer.from(message2), variant);
      expect(hash1).not.toEqual(hash2);
    }
  });

  it('should handle empty messages', () => {
    for (const variant of variants) {
      const hash = SHA3.hash(Buffer.from(''), variant);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    }
  });

  it('should handle large messages', () => {
    const largeMessage = randomBytes(1024 * 1024); // 1MB
    
    for (const variant of variants) {
      const hash = SHA3.hash(largeMessage, variant);
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
      const expectedHash = SHA3.hash(fullMessage, variant);

      // Streaming hash
      const hasher = new SHA3.Streaming(variant);
      for (const chunk of chunks) {
        await hasher.update(chunk);
      }
      const streamingHash = await hasher.finalize();

      expect(streamingHash).toEqual(expectedHash);
    }
  });

  it('should support KMAC', () => {
    const key = randomBytes(32);
    const customization = 'MyApp';
    
    // Test KMAC128 and KMAC256
    const kmac128_1 = SHA3.kmac(Buffer.from(message), key, 32, KeccakMode.KMAC128, customization);
    const kmac128_2 = SHA3.kmac(Buffer.from(message), key, 32, KeccakMode.KMAC128, customization);
    const kmac256_1 = SHA3.kmac(Buffer.from(message), key, 64, KeccakMode.KMAC256, customization);
    const kmac256_2 = SHA3.kmac(Buffer.from(message), key, 64, KeccakMode.KMAC256, customization);

    // KMAC should be deterministic
    expect(kmac128_1).toEqual(kmac128_2);
    expect(kmac256_1).toEqual(kmac256_2);

    // Different keys should produce different KMACs
    const differentKey = randomBytes(32);
    const kmac128_3 = SHA3.kmac(Buffer.from(message), differentKey, 32, KeccakMode.KMAC128, customization);
    expect(kmac128_1).not.toEqual(kmac128_3);
  });

  it('should support cSHAKE', () => {
    const customization = 'MyApp';
    const functionName = 'MyFunction';

    // Test cSHAKE128 and cSHAKE256
    const cshake128_1 = SHA3.cshake(Buffer.from(message), 32, KeccakMode.CSHAKE128, customization, functionName);
    const cshake128_2 = SHA3.cshake(Buffer.from(message), 32, KeccakMode.CSHAKE128, customization, functionName);
    const cshake256_1 = SHA3.cshake(Buffer.from(message), 64, KeccakMode.CSHAKE256, customization, functionName);
    const cshake256_2 = SHA3.cshake(Buffer.from(message), 64, KeccakMode.CSHAKE256, customization, functionName);

    // cSHAKE should be deterministic
    expect(cshake128_1).toEqual(cshake128_2);
    expect(cshake256_1).toEqual(cshake256_2);

    // Different customization strings should produce different outputs
    const differentCustomization = 'DifferentApp';
    const cshake128_3 = SHA3.cshake(Buffer.from(message), 32, KeccakMode.CSHAKE128, differentCustomization, functionName);
    expect(cshake128_1).not.toEqual(cshake128_3);
  });

  it('should support TupleHash', () => {
    const tuples = [
      Buffer.from('First'),
      Buffer.from('Second'),
      Buffer.from('Third')
    ];
    const customization = 'MyApp';

    // Test TupleHash128 and TupleHash256
    const tuple128_1 = SHA3.tupleHash(tuples, 32, KeccakMode.TUPLEHASH128, customization);
    const tuple128_2 = SHA3.tupleHash(tuples, 32, KeccakMode.TUPLEHASH128, customization);
    const tuple256_1 = SHA3.tupleHash(tuples, 64, KeccakMode.TUPLEHASH256, customization);
    const tuple256_2 = SHA3.tupleHash(tuples, 64, KeccakMode.TUPLEHASH256, customization);

    // TupleHash should be deterministic
    expect(tuple128_1).toEqual(tuple128_2);
    expect(tuple256_1).toEqual(tuple256_2);

    // Different tuple orderings should produce different outputs
    const reorderedTuples = [tuples[1], tuples[0], tuples[2]];
    const tuple128_3 = SHA3.tupleHash(reorderedTuples, 32, KeccakMode.TUPLEHASH128, customization);
    expect(tuple128_1).not.toEqual(tuple128_3);
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
        const hash = SHA3.hash(Buffer.from(msg), variant);
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
      const hash1 = SHA3.hash(message1, variant);
      const hash2 = SHA3.hash(message2, variant);

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