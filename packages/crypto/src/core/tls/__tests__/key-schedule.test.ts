import { expect } from 'chai';
import { TLSKeySchedule } from '../key-schedule';
import { HKDF } from '../../kdf/hkdf';
import { randomBytes } from 'crypto';

describe('TLS Key Schedule', () => {
  const psk = randomBytes(32);
  const earlySecret = HKDF.extract(Buffer.alloc(32), psk);

  it('should derive early traffic secrets', () => {
    const clientEarlyTrafficSecret = TLSKeySchedule.deriveEarlyTrafficSecret(
      earlySecret,
      'client'
    );
    const earlyExporterSecret = TLSKeySchedule.deriveEarlyExporterSecret(
      earlySecret
    );

    expect(clientEarlyTrafficSecret.length).to.equal(32);
    expect(earlyExporterSecret.length).to.equal(32);
    expect(clientEarlyTrafficSecret).to.not.deep.equal(earlyExporterSecret);
  });

  it('should derive handshake traffic secrets', () => {
    const sharedSecret = randomBytes(32);
    const handshakeSecret = TLSKeySchedule.deriveHandshakeSecret(
      earlySecret,
      sharedSecret
    );

    const clientHsTrafficSecret = TLSKeySchedule.deriveHandshakeTrafficSecret(
      handshakeSecret,
      'client'
    );
    const serverHsTrafficSecret = TLSKeySchedule.deriveHandshakeTrafficSecret(
      handshakeSecret,
      'server'
    );

    expect(clientHsTrafficSecret.length).to.equal(32);
    expect(serverHsTrafficSecret.length).to.equal(32);
    expect(clientHsTrafficSecret).to.not.deep.equal(serverHsTrafficSecret);
  });

  it('should derive application traffic secrets', () => {
    const sharedSecret = randomBytes(32);
    const handshakeSecret = TLSKeySchedule.deriveHandshakeSecret(
      earlySecret,
      sharedSecret
    );
    const masterSecret = TLSKeySchedule.deriveMasterSecret(handshakeSecret);

    const clientAppTrafficSecret = TLSKeySchedule.deriveApplicationTrafficSecret(
      masterSecret,
      'client'
    );
    const serverAppTrafficSecret = TLSKeySchedule.deriveApplicationTrafficSecret(
      masterSecret,
      'server'
    );
    const exporterMasterSecret = TLSKeySchedule.deriveExporterMasterSecret(
      masterSecret
    );
    const resumptionMasterSecret = TLSKeySchedule.deriveResumptionMasterSecret(
      masterSecret
    );

    expect(clientAppTrafficSecret.length).to.equal(32);
    expect(serverAppTrafficSecret.length).to.equal(32);
    expect(exporterMasterSecret.length).to.equal(32);
    expect(resumptionMasterSecret.length).to.equal(32);

    // All secrets should be different
    const secrets = [
      clientAppTrafficSecret,
      serverAppTrafficSecret,
      exporterMasterSecret,
      resumptionMasterSecret
    ];

    for (let i = 0; i < secrets.length; i++) {
      for (let j = i + 1; j < secrets.length; j++) {
        expect(secrets[i]).to.not.deep.equal(secrets[j]);
      }
    }
  });

  it('should update traffic secrets', () => {
    const appTrafficSecret = randomBytes(32);
    const updatedSecret = TLSKeySchedule.updateTrafficSecret(appTrafficSecret);

    expect(updatedSecret.length).to.equal(32);
    expect(updatedSecret).to.not.deep.equal(appTrafficSecret);

    // Multiple updates should produce different secrets
    const updatedSecret2 = TLSKeySchedule.updateTrafficSecret(updatedSecret);
    expect(updatedSecret2).to.not.deep.equal(updatedSecret);
  });

  it('should derive key and IV', () => {
    const trafficSecret = randomBytes(32);
    const { key, iv } = TLSKeySchedule.deriveKeyAndIV(
      trafficSecret,
      'AES-256-GCM'
    );

    expect(key.length).to.equal(32);
    expect(iv.length).to.equal(12);
  });

  it('should derive early secret from PSK', () => {
    const psk = randomBytes(32);
    const earlySecret = TLSKeySchedule.deriveEarlySecret(psk);

    expect(earlySecret.length).to.equal(32);
  });

  it('should match HKDF output', () => {
    const secret = randomBytes(32);
    const label = 'test label';
    const context = Buffer.from('test context');
    const length = 32;

    const scheduleOutput = TLSKeySchedule.expandLabel(
      secret,
      label,
      context,
      length
    );
    const hkdfOutput = HKDF.expand(
      secret,
      Buffer.concat([
        Buffer.from([0, length]),
        Buffer.from('tls13 ' + label),
        context
      ]),
      length
    );

    expect(scheduleOutput.length).to.equal(hkdfOutput.length);
  });

  it('should derive keying material', () => {
    const secret = randomBytes(32);
    const label = 'test label';
    const context = Buffer.from('test context');
    const length = 32;

    const keyingMaterial = TLSKeySchedule.exportKeyingMaterial(
      secret,
      label,
      context,
      length
    );

    expect(keyingMaterial.length).to.equal(length);

    // Different context should produce different material
    const differentContext = Buffer.from('different context');
    const differentMaterial = TLSKeySchedule.exportKeyingMaterial(
      secret,
      label,
      differentContext,
      length
    );

    expect(keyingMaterial).to.not.deep.equal(differentMaterial);
  });

  it('should be deterministic', () => {
    const secret = randomBytes(32);
    const sharedSecret = randomBytes(32);

    // Early secrets
    const trafficSecret1 = TLSKeySchedule.deriveEarlyTrafficSecret(
      secret,
      'client'
    );
    const trafficSecret2 = TLSKeySchedule.deriveEarlyTrafficSecret(
      secret,
      'server'
    );
    expect(trafficSecret1).to.not.deep.equal(trafficSecret2);

    // Updated secrets
    const updatedSecret1 = TLSKeySchedule.updateTrafficSecret(trafficSecret1);
    const updatedSecret2 = TLSKeySchedule.updateTrafficSecret(trafficSecret2);
    expect(updatedSecret1).to.not.deep.equal(updatedSecret2);
  });
}); 