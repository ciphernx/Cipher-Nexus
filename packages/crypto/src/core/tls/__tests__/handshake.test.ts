import { expect } from 'chai';
import { TLSHandshake } from '../handshake';
import { HandshakeType } from '../constants';
import { randomBytes } from 'crypto';

describe('TLS Handshake', () => {
  it('should create and parse client hello', () => {
    const clientRandom = randomBytes(32);
    const supportedVersions = [0x0304]; // TLS 1.3
    const cipherSuites = [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256'
    ];

    const extensions = new Map<string, any>([
      ['supported_versions', supportedVersions],
      ['key_share', [{ group: 'x25519', key: randomBytes(32) }]],
      ['signature_algorithms', ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256']]
    ]);

    const clientHello = TLSHandshake.createClientHello({
      random: clientRandom,
      cipherSuites,
      extensions
    });

    expect(clientHello.msgType).to.equal(HandshakeType.client_hello);
    expect(clientHello.random).to.deep.equal(clientRandom);

    // Parse the client hello
    const parsed = TLSHandshake.parseClientHello(clientHello.serialize());
    expect(parsed.random).to.deep.equal(clientRandom);
    expect(parsed.cipherSuites).to.deep.equal(cipherSuites);
    expect(parsed.extensions.get('supported_versions')).to.deep.equal(supportedVersions);
  });

  it('should create and parse server hello', () => {
    const serverRandom = randomBytes(32);
    const selectedVersion = 0x0304; // TLS 1.3
    const selectedCipherSuite = 'TLS_AES_128_GCM_SHA256';
    const keyShare = { group: 'x25519', key: randomBytes(32) };

    const extensions = new Map<string, any>([
      ['supported_versions', [selectedVersion]],
      ['key_share', keyShare]
    ]);

    const serverHello = TLSHandshake.createServerHello({
      random: serverRandom,
      cipherSuite: selectedCipherSuite,
      extensions
    });

    expect(serverHello.msgType).to.equal(HandshakeType.server_hello);
    expect(serverHello.random).to.deep.equal(serverRandom);

    // Parse the server hello
    const parsed = TLSHandshake.parseServerHello(serverHello.serialize());
    expect(parsed.random).to.deep.equal(serverRandom);
    expect(parsed.cipherSuite).to.equal(selectedCipherSuite);
    expect(parsed.extensions.get('supported_versions')[0]).to.equal(selectedVersion);
  });

  it('should create and parse encrypted extensions', () => {
    const extensions = new Map<string, any>([
      ['server_name', 'example.com'],
      ['max_fragment_length', 16384],
      ['application_layer_protocol_negotiation', ['h2', 'http/1.1']]
    ]);

    const encryptedExtensions = TLSHandshake.createEncryptedExtensions(extensions);

    expect(encryptedExtensions.msgType).to.equal(HandshakeType.encrypted_extensions);

    // Parse the encrypted extensions
    const parsed = TLSHandshake.parseEncryptedExtensions(encryptedExtensions.serialize());
    expect(parsed.extensions).to.deep.equal(extensions);
  });

  it('should create and parse certificate', () => {
    const certContext = randomBytes(32);
    const certData = randomBytes(1024);
    const extensions = new Map<string, Buffer>([
      ['status_request', Buffer.from([1])],
      ['signed_certificate_timestamp', randomBytes(32)]
    ]);

    const certificate = TLSHandshake.createCertificate({
      certContext,
      certData,
      extensions
    });

    expect(certificate.msgType).to.equal(HandshakeType.certificate);

    // Parse the certificate
    const parsed = TLSHandshake.parseCertificate(certificate.serialize());
    expect(parsed.certContext).to.deep.equal(certContext);
    expect(parsed.certData).to.deep.equal(certData);
    expect(parsed.extensions).to.deep.equal(extensions);
  });

  it('should create and parse certificate verify', () => {
    const signatureScheme = 'ecdsa_secp256r1_sha256';
    const signature = randomBytes(64);

    const certVerify = TLSHandshake.createCertificateVerify({
      signatureScheme,
      signature
    });

    expect(certVerify.msgType).to.equal(HandshakeType.certificate_verify);

    // Parse the certificate verify
    const parsed = TLSHandshake.parseCertificateVerify(certVerify.serialize());
    expect(parsed.signatureScheme).to.equal(signatureScheme);
    expect(parsed.signature).to.deep.equal(signature);
  });

  it('should create and parse finished', () => {
    const verifyData = randomBytes(32);

    const finished = TLSHandshake.createFinished(verifyData);

    expect(finished.msgType).to.equal(HandshakeType.finished);

    // Parse the finished message
    const parsed = TLSHandshake.parseFinished(finished.serialize());
    expect(parsed.verifyData).to.deep.equal(verifyData);
  });

  it('should reject invalid handshake messages', () => {
    expect(() => {
      TLSHandshake.parseClientHello(Buffer.alloc(0));
    }).to.throw('Invalid handshake message');

    expect(() => {
      TLSHandshake.parseServerHello(Buffer.alloc(0));
    }).to.throw('Invalid handshake message');

    expect(() => {
      TLSHandshake.parseEncryptedExtensions(Buffer.alloc(0));
    }).to.throw('Invalid handshake message');

    expect(() => {
      TLSHandshake.parseCertificate(Buffer.alloc(0));
    }).to.throw('Invalid handshake message');
  });

  it('should parse PSK identities', () => {
    const identities = [
      { identity: Buffer.from('psk1'), obfuscatedTicketAge: 0 },
      { identity: Buffer.from('psk2'), obfuscatedTicketAge: 100 }
    ];

    const binders = [
      randomBytes(32),
      randomBytes(32)
    ];

    const pskExtension = TLSHandshake.createPreSharedKeyExtension(identities, binders);
    const parsed = TLSHandshake.parsePreSharedKeyExtension(pskExtension);

    expect(parsed.identities).to.deep.equal(identities);
    expect(parsed.binders).to.deep.equal(binders);
  });

  it('should parse key shares', () => {
    const clientShares = [
      { group: 'x25519', key: randomBytes(32) },
      { group: 'secp256r1', key: randomBytes(32) }
    ];

    const keyShareExtension = TLSHandshake.createKeyShareExtension(clientShares);
    const parsed = TLSHandshake.parseKeyShareExtension(keyShareExtension);

    expect(parsed).to.deep.equal(clientShares);
  });

  it('should handle fragmentation', () => {
    const largeData = randomBytes(20000);
    const fragments = TLSHandshake.fragment(largeData);

    expect(fragments.length).to.be.greaterThan(1);
    expect(Buffer.concat(fragments)).to.deep.equal(largeData);
  });

  it('should reject invalid extensions', () => {
    expect(() => {
      TLSHandshake.parseExtension('unknown_extension', Buffer.alloc(0));
    }).to.throw('Unknown extension type');
  });
}); 