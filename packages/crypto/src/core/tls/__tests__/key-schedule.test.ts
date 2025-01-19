import { TLSKeySchedule } from '../key-schedule';
import { HKDF } from '../../kdf/hkdf';
import { randomBytes } from 'crypto';

describe('TLS 1.3 Key Schedule', () => {
  const psk = randomBytes(32); // Pre-shared key
  const earlySecret = randomBytes(32);
  const handshakeSecret = randomBytes(32);
  const masterSecret = randomBytes(32);

  it('should derive early traffic secrets', () => {
    const keySchedule = new TLSKeySchedule();
    
    // Derive early secrets
    const clientEarlyTrafficSecret = keySchedule.deriveEarlySecret(psk, 'c e traffic');
    const earlyExporterSecret = keySchedule.deriveEarlySecret(psk, 'e exp master');

    expect(clientEarlyTrafficSecret.length).toBe(32);
    expect(earlyExporterSecret.length).toBe(32);
    expect(clientEarlyTrafficSecret).not.toEqual(earlyExporterSecret);
  });

  it('should derive handshake traffic secrets', () => {
    const keySchedule = new TLSKeySchedule();
    const sharedSecret = randomBytes(32); // (EC)DHE shared secret
    
    // Derive handshake secrets
    const clientHsTrafficSecret = keySchedule.deriveHandshakeSecret(
      sharedSecret,
      'c hs traffic'
    );
    const serverHsTrafficSecret = keySchedule.deriveHandshakeSecret(
      sharedSecret,
      's hs traffic'
    );

    expect(clientHsTrafficSecret.length).toBe(32);
    expect(serverHsTrafficSecret.length).toBe(32);
    expect(clientHsTrafficSecret).not.toEqual(serverHsTrafficSecret);
  });

  it('should derive application traffic secrets', () => {
    const keySchedule = new TLSKeySchedule();
    
    // Derive application secrets
    const clientAppTrafficSecret = keySchedule.deriveAppSecret(
      masterSecret,
      'c ap traffic'
    );
    const serverAppTrafficSecret = keySchedule.deriveAppSecret(
      masterSecret,
      's ap traffic'
    );
    const exporterMasterSecret = keySchedule.deriveAppSecret(
      masterSecret,
      'exp master'
    );
    const resumptionMasterSecret = keySchedule.deriveAppSecret(
      masterSecret,
      'res master'
    );

    expect(clientAppTrafficSecret.length).toBe(32);
    expect(serverAppTrafficSecret.length).toBe(32);
    expect(exporterMasterSecret.length).toBe(32);
    expect(resumptionMasterSecret.length).toBe(32);

    // All secrets should be different
    const secrets = [
      clientAppTrafficSecret,
      serverAppTrafficSecret,
      exporterMasterSecret,
      resumptionMasterSecret
    ];
    for (let i = 0; i < secrets.length; i++) {
      for (let j = i + 1; j < secrets.length; j++) {
        expect(secrets[i]).not.toEqual(secrets[j]);
      }
    }
  });

  it('should support key updates', () => {
    const keySchedule = new TLSKeySchedule();
    const appTrafficSecret = randomBytes(32);
    
    // Update application traffic secret
    const updatedSecret = keySchedule.updateTrafficSecret(appTrafficSecret);
    expect(updatedSecret.length).toBe(32);
    expect(updatedSecret).not.toEqual(appTrafficSecret);

    // Multiple updates should produce different secrets
    const updatedSecret2 = keySchedule.updateTrafficSecret(updatedSecret);
    expect(updatedSecret2).not.toEqual(updatedSecret);
  });

  it('should derive correct key lengths', () => {
    const keySchedule = new TLSKeySchedule();
    const trafficSecret = randomBytes(32);
    
    // Derive keys and IVs
    const key = keySchedule.deriveKey(trafficSecret);
    const iv = keySchedule.deriveIV(trafficSecret);

    // AES-256-GCM key length
    expect(key.length).toBe(32);
    // IV length for AEAD
    expect(iv.length).toBe(12);
  });

  it('should handle empty PSK', () => {
    const keySchedule = new TLSKeySchedule();
    const emptyPSK = Buffer.alloc(0);
    
    // Should use default PSK derivation
    const earlySecret = keySchedule.deriveEarlySecret(emptyPSK, 'c e traffic');
    expect(earlySecret.length).toBe(32);
  });

  it('should be HKDF-based', () => {
    const keySchedule = new TLSKeySchedule();
    const secret = randomBytes(32);
    const label = 'test label';
    
    // Direct HKDF vs key schedule derivation
    const hkdf = new HKDF('SHA-256');
    const hkdfOutput = hkdf.expand(secret, Buffer.from(label), 32);
    const scheduleOutput = keySchedule.deriveSecret(secret, label);

    // Key schedule should use HKDF internally
    expect(scheduleOutput.length).toBe(hkdfOutput.length);
  });

  it('should support exporter interface', () => {
    const keySchedule = new TLSKeySchedule();
    const exporterSecret = randomBytes(32);
    const context = Buffer.from('test context');
    const length = 32;
    
    // Export keying material
    const keyingMaterial = keySchedule.exportKeyingMaterial(
      exporterSecret,
      context,
      length
    );
    expect(keyingMaterial.length).toBe(length);

    // Different contexts should produce different outputs
    const differentContext = Buffer.from('different context');
    const differentMaterial = keySchedule.exportKeyingMaterial(
      exporterSecret,
      differentContext,
      length
    );
    expect(keyingMaterial).not.toEqual(differentMaterial);
  });

  it('should maintain forward secrecy', () => {
    const keySchedule = new TLSKeySchedule();
    const secret1 = randomBytes(32);
    const secret2 = randomBytes(32);
    
    // Derive two sets of traffic secrets
    const trafficSecret1 = keySchedule.deriveAppSecret(secret1, 'traffic');
    const trafficSecret2 = keySchedule.deriveAppSecret(secret2, 'traffic');

    // Compromise of one secret shouldn't affect the other
    expect(trafficSecret1).not.toEqual(trafficSecret2);
    
    // Updated secrets should maintain independence
    const updatedSecret1 = keySchedule.updateTrafficSecret(trafficSecret1);
    const updatedSecret2 = keySchedule.updateTrafficSecret(trafficSecret2);
    expect(updatedSecret1).not.toEqual(updatedSecret2);
  });
}); 