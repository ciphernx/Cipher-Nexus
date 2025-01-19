import { TLSRecordLayer } from '../record-layer';
import { ContentType, ProtocolVersion } from '../constants';
import { randomBytes } from 'crypto';

describe('TLS 1.3 Record Layer', () => {
  const key = randomBytes(32); // AES-256-GCM key
  const iv = randomBytes(12);  // 96-bit IV for AEAD
  const plaintext = Buffer.from('Hello, TLS 1.3!');
  const additionalData = Buffer.from('additional data');

  it('should encrypt and decrypt application data', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;

    // Encrypt record
    const encrypted = recordLayer.encryptRecord({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: plaintext,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    expect(encrypted.type).toBe(ContentType.application_data);
    expect(encrypted.version).toBe(ProtocolVersion.TLS_1_3);

    // Decrypt record
    const decrypted = recordLayer.decryptRecord({
      record: encrypted,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    expect(decrypted.content).toEqual(plaintext);
    expect(decrypted.type).toBe(ContentType.application_data);
  });

  it('should handle sequence numbers correctly', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumbers = [0n, 1n, 2n, 0xFFFFFFFFFFFFFFFFn];

    for (const sequenceNumber of sequenceNumbers) {
      const encrypted = recordLayer.encryptRecord({
        type: ContentType.application_data,
        version: ProtocolVersion.TLS_1_3,
        content: plaintext,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      const decrypted = recordLayer.decryptRecord({
        record: encrypted,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      expect(decrypted.content).toEqual(plaintext);
    }
  });

  it('should detect tampering with ciphertext', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;

    const encrypted = recordLayer.encryptRecord({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: plaintext,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    // Tamper with ciphertext
    encrypted.fragment[0] ^= 1;

    expect(() => {
      recordLayer.decryptRecord({
        record: encrypted,
        key,
        iv,
        sequenceNumber,
        additionalData
      });
    }).toThrow('decryption failed');
  });

  it('should detect tampering with additional data', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;

    const encrypted = recordLayer.encryptRecord({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: plaintext,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    // Tamper with additional data
    const tamperedAD = Buffer.from(additionalData);
    tamperedAD[0] ^= 1;

    expect(() => {
      recordLayer.decryptRecord({
        record: encrypted,
        key,
        iv,
        sequenceNumber,
        additionalData: tamperedAD
      });
    }).toThrow('decryption failed');
  });

  it('should handle record fragmentation', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;
    const largeData = randomBytes(16384); // 16KB data

    // Fragment and encrypt
    const fragments = recordLayer.fragmentAndEncrypt({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: largeData,
      key,
      iv,
      sequenceNumber,
      additionalData,
      maxFragmentLength: 8192 // 8KB fragments
    });

    expect(fragments.length).toBeGreaterThan(1);

    // Decrypt and reassemble
    const reassembled = recordLayer.decryptAndReassemble({
      fragments,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    expect(reassembled).toEqual(largeData);
  });

  it('should handle different content types', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;
    const contentTypes = [
      ContentType.alert,
      ContentType.handshake,
      ContentType.application_data
    ];

    for (const type of contentTypes) {
      const encrypted = recordLayer.encryptRecord({
        type,
        version: ProtocolVersion.TLS_1_3,
        content: plaintext,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      const decrypted = recordLayer.decryptRecord({
        record: encrypted,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      expect(decrypted.type).toBe(type);
      expect(decrypted.content).toEqual(plaintext);
    }
  });

  it('should handle zero-length records', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;
    const emptyContent = Buffer.alloc(0);

    const encrypted = recordLayer.encryptRecord({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: emptyContent,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    const decrypted = recordLayer.decryptRecord({
      record: encrypted,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    expect(decrypted.content.length).toBe(0);
  });

  it('should handle padding', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;
    const paddingLength = 1024; // 1KB padding

    const encrypted = recordLayer.encryptRecordWithPadding({
      type: ContentType.application_data,
      version: ProtocolVersion.TLS_1_3,
      content: plaintext,
      key,
      iv,
      sequenceNumber,
      additionalData,
      paddingLength
    });

    expect(encrypted.fragment.length).toBeGreaterThan(plaintext.length + paddingLength);

    const decrypted = recordLayer.decryptRecord({
      record: encrypted,
      key,
      iv,
      sequenceNumber,
      additionalData
    });

    expect(decrypted.content).toEqual(plaintext);
  });

  it('should reject invalid version numbers', () => {
    const recordLayer = new TLSRecordLayer();
    const sequenceNumber = 0n;

    expect(() => {
      recordLayer.encryptRecord({
        type: ContentType.application_data,
        version: 0x0301, // TLS 1.0 not allowed
        content: plaintext,
        key,
        iv,
        sequenceNumber,
        additionalData
      });
    }).toThrow('invalid version');
  });

  it('should maintain record layer state', () => {
    const recordLayer = new TLSRecordLayer();
    let sequenceNumber = 0n;

    // Send multiple records
    for (let i = 0; i < 5; i++) {
      const encrypted = recordLayer.encryptRecord({
        type: ContentType.application_data,
        version: ProtocolVersion.TLS_1_3,
        content: plaintext,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      const decrypted = recordLayer.decryptRecord({
        record: encrypted,
        key,
        iv,
        sequenceNumber,
        additionalData
      });

      expect(decrypted.content).toEqual(plaintext);
      sequenceNumber++;
    }

    expect(recordLayer.getSequenceNumber()).toBe(5n);
  });
}); 