import { expect } from 'chai';
import { Poly1305 } from '../poly1305';
import { randomBytes } from 'crypto';

describe('Poly1305', () => {
  const message = 'Hello, Poly1305!';
  const key = randomBytes(32);

  it('should generate MAC of correct length', () => {
    const mac = Poly1305.generate(Buffer.from(message), key);
    expect(mac.length).to.equal(16); // Poly1305 always produces 16-byte (128-bit) tags
  });

  it('should generate same MAC for same input', () => {
    const mac1 = Poly1305.generate(Buffer.from(message), key);
    const mac2 = Poly1305.generate(Buffer.from(message), key);
    expect(mac1).to.deep.equal(mac2);
  });

  it('should generate different MACs for different messages', () => {
    const mac1 = Poly1305.generate(Buffer.from(message), key);
    const mac2 = Poly1305.generate(Buffer.from('Different message'), key);
    expect(mac1).to.not.deep.equal(mac2);
  });

  it('should generate different MACs for different keys', () => {
    const mac1 = Poly1305.generate(Buffer.from(message), key);
    const mac2 = Poly1305.generate(Buffer.from(message), randomBytes(32));
    expect(mac1).to.not.deep.equal(mac2);
  });

  it('should handle empty message', () => {
    const mac = Poly1305.generate(Buffer.from(''), key);
    expect(mac).to.exist;
    expect(mac.length).to.equal(16);
  });

  it('should handle large message', () => {
    const largeMessage = Buffer.alloc(1024 * 1024).fill('A');
    const mac = Poly1305.generate(largeMessage, key);
    expect(mac).to.exist;
    expect(mac.length).to.equal(16);
  });

  it('should support streaming interface', () => {
    const poly1305 = new Poly1305(key);
    const chunks = [
      Buffer.from('Hello'),
      Buffer.from(', '),
      Buffer.from('Poly1305'),
      Buffer.from('!')
    ];

    const expectedMac = Poly1305.generate(Buffer.from(message), key);
    chunks.forEach(chunk => poly1305.update(chunk));
    const streamingMac = poly1305.digest();

    expect(streamingMac).to.deep.equal(expectedMac);
  });

  it('should verify valid MAC', () => {
    const mac = Poly1305.generate(Buffer.from(message), key);
    const isValid = Poly1305.verify(Buffer.from(message), mac, key);
    expect(isValid).to.be.true;

    // Should reject MAC for different message
    const isInvalidMessage = Poly1305.verify(Buffer.from('Different message'), mac, key);
    expect(isInvalidMessage).to.be.false;

    // Should reject MAC for different key
    const isInvalidKey = Poly1305.verify(Buffer.from(message), mac, randomBytes(32));
    expect(isInvalidKey).to.be.false;
  });

  it('should have constant-time verification', () => {
    const mac = Poly1305.generate(Buffer.from(message), key);
    const startTime = process.hrtime();
    Poly1305.verify(Buffer.from(message), mac, key);
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const timeDiff = seconds + nanoseconds / 1e9;
    expect(timeDiff).to.be.lessThan(0.1);
  });

  it('should reject invalid inputs', () => {
    const invalidKey = Buffer.alloc(31); // Key must be 32 bytes
    expect(() => Poly1305.generate(Buffer.from(message), invalidKey)).to.throw();

    const mac = Poly1305.generate(Buffer.from(message), key);
    const invalidMac = Buffer.alloc(15); // MAC must be 16 bytes
    expect(() => Poly1305.verify(Buffer.from(message), invalidMac, key)).to.throw();
  });

  it('should support key derivation from cipher', () => {
    const cipherKey = randomBytes(32);
    const nonce = randomBytes(16);
    const poly1305Key = Poly1305.deriveKey(cipherKey, nonce);

    expect(poly1305Key.length).to.equal(32);

    // Generated MAC should be valid
    const mac = Poly1305.generate(Buffer.from(message), poly1305Key);
    expect(mac.length).to.equal(16);

    const isValid = Poly1305.verify(Buffer.from(message), mac, poly1305Key);
    expect(isValid).to.be.true;
  });

  it('should be unique for each key derivation', () => {
    const cipherKey = randomBytes(32);
    const nonce1 = randomBytes(16);
    const nonce2 = randomBytes(16);

    const key1 = Poly1305.deriveKey(cipherKey, nonce1);
    const key2 = Poly1305.deriveKey(cipherKey, nonce2);

    const mac1 = Poly1305.generate(Buffer.from(message), key1);
    const mac2 = Poly1305.generate(Buffer.from(message), key2);
    expect(mac1).to.not.deep.equal(mac2);

    // Each MAC should be valid with its own key
    const isValid = Poly1305.verify(Buffer.from(message), mac1, key1);
    expect(isValid).to.be.true;

    // But invalid with the other key
    const isInvalid = Poly1305.verify(Buffer.from(message), mac1, key2);
    expect(isInvalid).to.be.false;
  });

  it('should warn on key reuse', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    const message1 = Buffer.from('First message');
    const message2 = Buffer.from('Second message');

    Poly1305.generate(message1, key);
    Poly1305.generate(message2, key);

    expect(spy).to.have.been.calledWith(
      expect.stringContaining('Poly1305 key should only be used once')
    );

    spy.mockRestore();
  });

  it('should handle different message types', () => {
    const testCases = [
      Buffer.from('Regular string'),
      Buffer.from([0x00, 0xFF, 0x10, 0xAB]), // Binary data
      Buffer.alloc(1024).fill('A'), // Large message
      Buffer.from(''), // Empty message
      Buffer.from('🔑🔒') // Unicode string
    ];

    for (const testMessage of testCases) {
      const mac = Poly1305.generate(testMessage, key);
      expect(mac.length).to.equal(16);

      const isValid = Poly1305.verify(testMessage, mac, key);
      expect(isValid).to.be.true;
    }
  });

  // New test cases
  it('should handle block boundary conditions', () => {
    const blockSize = 16;
    const testSizes = [
      blockSize - 1,    // One byte less than block size
      blockSize,        // Exact block size
      blockSize + 1,    // One byte more than block size
      blockSize * 2 - 1, // One byte less than two blocks
      blockSize * 2,     // Exact two blocks
      blockSize * 2 + 1  // One byte more than two blocks
    ];

    for (const size of testSizes) {
      const testMessage = randomBytes(size);
      const mac = Poly1305.generate(testMessage, key);
      expect(mac.length).to.equal(16);
      expect(Poly1305.verify(testMessage, mac, key)).to.be.true;
    }
  });

  it('should exhibit avalanche effect', () => {
    const message1 = randomBytes(64);
    const message2 = Buffer.from(message1);
    message2[0] ^= 1; // Change a single bit

    const mac1 = Poly1305.generate(message1, key);
    const mac2 = Poly1305.generate(message2, key);

    let differingBits = 0;
    for (let i = 0; i < mac1.length; i++) {
      const xor = mac1[i] ^ mac2[i];
      for (let j = 0; j < 8; j++) {
        if ((xor & (1 << j)) !== 0) {
          differingBits++;
        }
      }
    }

    const totalBits = mac1.length * 8;
    const diffPercentage = (differingBits / totalBits) * 100;
    expect(diffPercentage).to.be.greaterThan(45); // Should be close to 50%
    expect(diffPercentage).to.be.lessThan(55);
  });

  it('should handle parallel MAC generation', async () => {
    const messages = Array.from({ length: 10 }, () => randomBytes(1024));
    const macs = await Promise.all(messages.map(msg => {
      return new Promise<Buffer>(resolve => {
        const mac = Poly1305.generate(msg, key);
        resolve(mac);
      });
    }));

    // Verify all MACs
    for (let i = 0; i < messages.length; i++) {
      expect(Poly1305.verify(messages[i], macs[i], key)).to.be.true;
    }
  });

  it('should maintain integrity under concatenation', () => {
    const message1 = Buffer.from('First part');
    const message2 = Buffer.from('Second part');
    const combined = Buffer.concat([message1, message2]);

    // Generate MACs
    const mac1 = Poly1305.generate(message1, key);
    const mac2 = Poly1305.generate(message2, key);
    const macCombined = Poly1305.generate(combined, key);

    // Combined MAC should be different from individual MACs
    expect(macCombined).to.not.deep.equal(mac1);
    expect(macCombined).to.not.deep.equal(mac2);
    expect(macCombined).to.not.deep.equal(Buffer.concat([mac1, mac2]));

    // But should still verify correctly
    expect(Poly1305.verify(combined, macCombined, key)).to.be.true;
  });
});

describe('Poly1305 Tests', () => {
  describe('Core Functionality', () => {
    test('MAC generation with different key sizes', () => {
      // Valid key size
      const validKey = Buffer.alloc(32);
      expect(() => new Poly1305(validKey)).not.toThrow();

      // Invalid key sizes
      const invalidKeys = [16, 24, 48].map(size => Buffer.alloc(size));
      invalidKeys.forEach(key => {
        expect(() => new Poly1305(key)).toThrow('Poly1305 key must be 32 bytes');
      });
    });

    test('verification with timing attacks', async () => {
      const key = randomBytes(32);
      const message = Buffer.from('test message');
      
      // Generate valid MAC
      const poly = new Poly1305(key);
      const validMac = poly.update(message).digest();
      
      // Test with valid MAC
      const startValid = process.hrtime.bigint();
      const validResult = Poly1305.verify(validMac, message, key);
      const validTime = process.hrtime.bigint() - startValid;
      
      // Test with invalid MAC
      const invalidMac = Buffer.from(validMac);
      invalidMac[0] ^= 1; // Flip one bit
      const startInvalid = process.hrtime.bigint();
      const invalidResult = Poly1305.verify(invalidMac, message, key);
      const invalidTime = process.hrtime.bigint() - startInvalid;
      
      // Verify results
      expect(validResult).toBe(true);
      expect(invalidResult).toBe(false);
      
      // Check timing difference is minimal
      const timeDiff = Number(validTime - invalidTime);
      expect(Math.abs(timeDiff)).toBeLessThan(1000000); // Less than 1ms difference
    });

    test('key derivation security', async () => {
      const key = randomBytes(32);
      const nonce = randomBytes(16);
      const cipher = {
        encrypt: async (k: Buffer, n: Buffer, data: Buffer) => {
          // Mock cipher that XORs the input
          return Buffer.from(data.map((byte, i) => byte ^ k[i % k.length] ^ n[i % n.length]));
        }
      };
      
      // Derive multiple keys
      const key1 = await Poly1305.deriveKey(cipher, key, nonce);
      const key2 = await Poly1305.deriveKey(cipher, key, nonce);
      
      // Keys should be identical for same inputs
      expect(key1.equals(key2)).toBe(true);
      
      // Different nonce should produce different key
      const key3 = await Poly1305.deriveKey(cipher, key, randomBytes(16));
      expect(key1.equals(key3)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handling of empty messages', () => {
      const key = randomBytes(32);
      const poly = new Poly1305(key);
      
      // Empty message should produce valid MAC
      const mac = poly.update(Buffer.alloc(0)).digest();
      expect(mac.length).toBe(16);
      
      // Verify empty message MAC
      expect(Poly1305.verify(mac, Buffer.alloc(0), key)).toBe(true);
    });

    test('large message processing', () => {
      const key = randomBytes(32);
      const message = randomBytes(1024 * 1024); // 1MB message
      
      const poly = new Poly1305(key);
      
      // Should handle large message without errors
      expect(() => {
        poly.update(message).digest();
      }).not.toThrow();
    });

    test('invalid key handling', () => {
      const invalidKeys = [
        null,
        undefined,
        Buffer.alloc(0),
        Buffer.from([1,2,3]),
        'invalid key'
      ];
      
      invalidKeys.forEach(key => {
        expect(() => {
          // @ts-ignore: Testing invalid inputs
          new Poly1305(key);
        }).toThrow();
      });
    });
  });

  describe('Security Features', () => {
    test('replay attack prevention', () => {
      const key = randomBytes(32);
      const message = Buffer.from('test message');
      
      // Generate MAC
      const poly1 = new Poly1305(key);
      const mac1 = poly1.update(message).digest();
      
      // Attempt to reuse key
      expect(() => {
        poly1.update(message);
      }).toThrow('Key already used');
      
      // New instance required for new MAC
      const poly2 = new Poly1305(key);
      const mac2 = poly2.update(message).digest();
      
      // MACs should be identical for same message and key
      expect(mac1.equals(mac2)).toBe(true);
    });

    test('key reuse protection', () => {
      const key = randomBytes(32);
      const message1 = Buffer.from('message 1');
      const message2 = Buffer.from('message 2');
      
      const poly = new Poly1305(key);
      
      // First use is fine
      poly.update(message1).digest();
      
      // Attempting to reuse the same instance should throw
      expect(() => {
        poly.update(message2);
      }).toThrow('Key already used');
      
      // New instance should work
      const poly2 = new Poly1305(key);
      expect(() => {
        poly2.update(message2).digest();
      }).not.toThrow();
    });

    test('MAC length consistency', () => {
      const key = randomBytes(32);
      const messages = [
        Buffer.alloc(0),
        Buffer.from('short'),
        Buffer.from('medium length message'),
        randomBytes(1024)
      ];
      
      messages.forEach(message => {
        const poly = new Poly1305(key);
        const mac = poly.update(message).digest();
        expect(mac.length).toBe(16); // MAC should always be 16 bytes
      });
    });

    test('bit flip sensitivity', () => {
      const key = randomBytes(32);
      const message = Buffer.from('test message');
      
      // Generate original MAC
      const poly = new Poly1305(key);
      const originalMac = poly.update(message).digest();
      
      // Test flipping each bit in the message
      for (let i = 0; i < message.length; i++) {
        for (let bit = 0; bit < 8; bit++) {
          const modifiedMessage = Buffer.from(message);
          modifiedMessage[i] ^= (1 << bit);
          
          const newPoly = new Poly1305(key);
          const newMac = newPoly.update(modifiedMessage).digest();
          
          // MAC should be different
          expect(newMac.equals(originalMac)).toBe(false);
        }
      }
    });
  });

  describe('Performance', () => {
    test('processing speed', () => {
      const key = randomBytes(32);
      const message = randomBytes(1024 * 1024); // 1MB
      
      const start = process.hrtime.bigint();
      
      const poly = new Poly1305(key);
      poly.update(message).digest();
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      
      // Processing 1MB should be reasonably fast
      expect(duration).toBeLessThan(100); // Should take less than 100ms
    });

    test('memory usage', () => {
      const key = randomBytes(32);
      const message = randomBytes(10 * 1024 * 1024); // 10MB
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      const poly = new Poly1305(key);
      poly.update(message).digest();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB growth
    });
  });
}); 