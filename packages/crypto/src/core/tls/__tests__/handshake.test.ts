import { TLSHandshake } from '../handshake';
import { HandshakeType } from '../constants';
import { randomBytes } from 'crypto';

describe('TLS 1.3 Handshake', () => {
  const clientRandom = randomBytes(32);
  const serverRandom = randomBytes(32);

  it('should create and parse ClientHello message', () => {
    const handshake = new TLSHandshake();
    const supportedVersions = [0x0304]; // TLS 1.3
    const cipherSuites = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'];
    const extensions = new Map([
      ['supported_versions', supportedVersions],
      ['key_share', [{ group: 'x25519', key: randomBytes(32) }]],
      ['signature_algorithms', ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256']]
    ]);

    // Create ClientHello
    const clientHello = handshake.createClientHello({
      random: clientRandom,
      cipherSuites,
      extensions
    });

    expect(clientHello.msgType).toBe(HandshakeType.client_hello);
    expect(clientHello.random).toEqual(clientRandom);
    
    // Parse ClientHello
    const parsed = handshake.parseClientHello(clientHello.serialize());
    expect(parsed.random).toEqual(clientRandom);
    expect(parsed.cipherSuites).toEqual(cipherSuites);
    expect(parsed.extensions.get('supported_versions')).toEqual(supportedVersions);
  });

  it('should create and parse ServerHello message', () => {
    const handshake = new TLSHandshake();
    const selectedVersion = 0x0304; // TLS 1.3
    const selectedCipherSuite = 'TLS_AES_256_GCM_SHA384';
    const extensions = new Map([
      ['supported_versions', [selectedVersion]],
      ['key_share', { group: 'x25519', key: randomBytes(32) }]
    ]);

    // Create ServerHello
    const serverHello = handshake.createServerHello({
      random: serverRandom,
      cipherSuite: selectedCipherSuite,
      extensions
    });

    expect(serverHello.msgType).toBe(HandshakeType.server_hello);
    expect(serverHello.random).toEqual(serverRandom);
    
    // Parse ServerHello
    const parsed = handshake.parseServerHello(serverHello.serialize());
    expect(parsed.random).toEqual(serverRandom);
    expect(parsed.cipherSuite).toBe(selectedCipherSuite);
    expect(parsed.extensions.get('supported_versions')[0]).toBe(selectedVersion);
  });

  it('should create and parse EncryptedExtensions message', () => {
    const handshake = new TLSHandshake();
    const extensions = new Map([
      ['server_name', 'example.com'],
      ['max_fragment_length', 16384],
      ['application_layer_protocol_negotiation', ['h2', 'http/1.1']]
    ]);

    // Create EncryptedExtensions
    const encryptedExtensions = handshake.createEncryptedExtensions(extensions);
    expect(encryptedExtensions.msgType).toBe(HandshakeType.encrypted_extensions);
    
    // Parse EncryptedExtensions
    const parsed = handshake.parseEncryptedExtensions(encryptedExtensions.serialize());
    expect(parsed.extensions).toEqual(extensions);
  });

  it('should create and parse Certificate message', () => {
    const handshake = new TLSHandshake();
    const certContext = randomBytes(32);
    const certData = randomBytes(1024); // Mock certificate data
    const extensions = new Map([
      ['status_request', Buffer.from([1])],
      ['signed_certificate_timestamp', [randomBytes(32)]]
    ]);

    // Create Certificate
    const certificate = handshake.createCertificate({
      certContext,
      certData,
      extensions
    });

    expect(certificate.msgType).toBe(HandshakeType.certificate);
    
    // Parse Certificate
    const parsed = handshake.parseCertificate(certificate.serialize());
    expect(parsed.certContext).toEqual(certContext);
    expect(parsed.certData).toEqual(certData);
    expect(parsed.extensions).toEqual(extensions);
  });

  it('should create and parse CertificateVerify message', () => {
    const handshake = new TLSHandshake();
    const signatureScheme = 'ecdsa_secp256r1_sha256';
    const signature = randomBytes(64); // Mock ECDSA signature

    // Create CertificateVerify
    const certVerify = handshake.createCertificateVerify({
      signatureScheme,
      signature
    });

    expect(certVerify.msgType).toBe(HandshakeType.certificate_verify);
    
    // Parse CertificateVerify
    const parsed = handshake.parseCertificateVerify(certVerify.serialize());
    expect(parsed.signatureScheme).toBe(signatureScheme);
    expect(parsed.signature).toEqual(signature);
  });

  it('should create and parse Finished message', () => {
    const handshake = new TLSHandshake();
    const verifyData = randomBytes(32); // HMAC of handshake messages

    // Create Finished
    const finished = handshake.createFinished(verifyData);
    expect(finished.msgType).toBe(HandshakeType.finished);
    
    // Parse Finished
    const parsed = handshake.parseFinished(finished.serialize());
    expect(parsed.verifyData).toEqual(verifyData);
  });

  it('should validate handshake message order', () => {
    const handshake = new TLSHandshake();
    
    // Client messages
    expect(() => {
      handshake.validateMessageOrder(HandshakeType.client_hello, true);
    }).not.toThrow();

    expect(() => {
      handshake.validateMessageOrder(HandshakeType.certificate_verify, true);
    }).toThrow();

    // Server messages
    expect(() => {
      handshake.validateMessageOrder(HandshakeType.server_hello, false);
    }).not.toThrow();

    expect(() => {
      handshake.validateMessageOrder(HandshakeType.finished, false);
    }).toThrow();
  });

  it('should handle PSK extensions', () => {
    const handshake = new TLSHandshake();
    const identities = [
      { identity: randomBytes(32), obfuscatedTicketAge: 1000 },
      { identity: randomBytes(32), obfuscatedTicketAge: 2000 }
    ];
    const binders = [randomBytes(32), randomBytes(32)];

    // Create PSK extension
    const pskExt = handshake.createPreSharedKeyExtension(identities, binders);
    
    // Parse PSK extension
    const parsed = handshake.parsePreSharedKeyExtension(pskExt);
    expect(parsed.identities).toEqual(identities);
    expect(parsed.binders).toEqual(binders);
  });

  it('should handle KeyShare extensions', () => {
    const handshake = new TLSHandshake();
    const clientShares = [
      { group: 'x25519', key: randomBytes(32) },
      { group: 'secp256r1', key: randomBytes(32) }
    ];

    // Create KeyShare extension
    const keyShareExt = handshake.createKeyShareExtension(clientShares);
    
    // Parse KeyShare extension
    const parsed = handshake.parseKeyShareExtension(keyShareExt);
    expect(parsed).toEqual(clientShares);
  });

  it('should handle message fragmentation', () => {
    const handshake = new TLSHandshake();
    const largeData = randomBytes(16384); // 16KB of data
    const fragments = handshake.fragmentMessage(largeData, 8192); // 8KB fragments

    expect(fragments.length).toBe(2);
    expect(Buffer.concat(fragments)).toEqual(largeData);
  });

  it('should detect invalid messages', () => {
    const handshake = new TLSHandshake();
    const invalidData = randomBytes(32);

    expect(() => {
      handshake.parseHandshakeMessage(invalidData);
    }).toThrow();
  });
}); 