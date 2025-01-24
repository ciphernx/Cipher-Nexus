import { createHmac } from 'crypto';

export class TLSKeySchedule {
  private static readonly HASH_LENGTH = 32; // SHA-256

  public static deriveEarlySecret(psk: Buffer): Buffer {
    return this.extract(Buffer.alloc(this.HASH_LENGTH), psk);
  }

  public static deriveEarlyTrafficSecret(secret: Buffer, label: 'client' | 'server'): Buffer {
    return this.expandLabel(secret, `${label} early traffic secret`, Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveEarlyExporterSecret(secret: Buffer): Buffer {
    return this.expandLabel(secret, 'early exporter secret', Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveHandshakeSecret(earlySecret: Buffer, sharedSecret: Buffer): Buffer {
    const derivedSecret = this.expandLabel(earlySecret, 'derived', Buffer.alloc(0), this.HASH_LENGTH);
    return this.extract(derivedSecret, sharedSecret);
  }

  public static deriveHandshakeTrafficSecret(secret: Buffer, label: 'client' | 'server'): Buffer {
    return this.expandLabel(secret, `${label} handshake traffic secret`, Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveMasterSecret(handshakeSecret: Buffer): Buffer {
    const derivedSecret = this.expandLabel(handshakeSecret, 'derived', Buffer.alloc(0), this.HASH_LENGTH);
    return this.extract(derivedSecret, Buffer.alloc(0));
  }

  public static deriveApplicationTrafficSecret(secret: Buffer, label: 'client' | 'server'): Buffer {
    return this.expandLabel(secret, `${label} application traffic secret`, Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveExporterMasterSecret(secret: Buffer): Buffer {
    return this.expandLabel(secret, 'exporter master secret', Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveResumptionMasterSecret(secret: Buffer): Buffer {
    return this.expandLabel(secret, 'resumption master secret', Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static updateTrafficSecret(secret: Buffer): Buffer {
    return this.expandLabel(secret, 'traffic upd', Buffer.alloc(0), this.HASH_LENGTH);
  }

  public static deriveKeyAndIV(secret: Buffer, cipherSuite: string): { key: Buffer; iv: Buffer } {
    const keyLength = cipherSuite.includes('256') ? 32 : 16;
    const ivLength = 12;

    const key = this.expandLabel(secret, 'key', Buffer.alloc(0), keyLength);
    const iv = this.expandLabel(secret, 'iv', Buffer.alloc(0), ivLength);

    return { key, iv };
  }

  public static expandLabel(secret: Buffer, label: string, context: Buffer, length: number): Buffer {
    const hkdfLabel = Buffer.concat([
      Buffer.from([0, length]),
      Buffer.from('tls13 ' + label),
      context
    ]);
    return this.expand(secret, hkdfLabel, length);
  }

  public static exportKeyingMaterial(secret: Buffer, label: string, context: Buffer, length: number): Buffer {
    return this.expandLabel(secret, label, context, length);
  }

  private static extract(salt: Buffer, ikm: Buffer): Buffer {
    const hmac = createHmac('sha256', salt);
    hmac.update(ikm);
    return hmac.digest();
  }

  private static expand(prk: Buffer, info: Buffer, length: number): Buffer {
    const hmac = createHmac('sha256', prk);
    let output = Buffer.alloc(0);
    let T = Buffer.alloc(0);
    let i = 1;

    while (output.length < length) {
      const input = Buffer.concat([T, info, Buffer.from([i])]);
      hmac.update(input);
      T = hmac.digest();
      output = Buffer.concat([output, T]);
      i++;
    }

    return output.slice(0, length);
  }
} 