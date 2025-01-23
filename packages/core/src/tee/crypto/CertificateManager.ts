import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { KeyManager, KeyEntry } from './KeyManager';
import { createHash, randomFillSync, createSign, createVerify } from 'crypto';

export interface CertificateConfig {
  issuer: string;
  validityPeriod: number;  // milliseconds
  keyType: string;
  signatureAlgorithm: string;
  extensions?: Record<string, any>;
}

export interface CertificateMetadata {
  serialNumber: string;
  subject: string;
  issuer: string;
  notBefore: number;
  notAfter: number;
  status: 'valid' | 'expired' | 'revoked';
  keyId: string;
  fingerprint: string;
}

export interface Certificate {
  metadata: CertificateMetadata;
  publicKey: Buffer;
  signature: Buffer;
  raw: Buffer;
}

export class CertificateManager extends EventEmitter {
  private readonly config: CertificateConfig;
  private readonly keyManager: KeyManager;
  private certificates: Map<string, Certificate>;
  private revocationList: Set<string>;
  private readonly validationInterval: NodeJS.Timeout;

  constructor(config: CertificateConfig, keyManager: KeyManager) {
    super();
    this.config = config;
    this.keyManager = keyManager;
    this.certificates = new Map();
    this.revocationList = new Set();

    // Start certificate validation
    this.validationInterval = setInterval(
      () => this.validateCertificates(),
      Math.min(this.config.validityPeriod / 10, 3600000)
    );
  }

  async createCertificate(
    subject: string,
    publicKey: Buffer
  ): Promise<Certificate> {
    try {
      // Generate signing key if needed
      const signingKey = await this.getOrCreateSigningKey();

      // Create certificate metadata
      const now = Date.now();
      const metadata: CertificateMetadata = {
        serialNumber: this.generateSerialNumber(),
        subject,
        issuer: this.config.issuer,
        notBefore: now,
        notAfter: now + this.config.validityPeriod,
        status: 'valid',
        keyId: signingKey.metadata.id,
        fingerprint: this.calculateFingerprint(publicKey)
      };

      // Create certificate data
      const certData = Buffer.concat([
        Buffer.from(metadata.serialNumber),
        Buffer.from(metadata.subject),
        Buffer.from(metadata.issuer),
        Buffer.from(metadata.notBefore.toString()),
        Buffer.from(metadata.notAfter.toString()),
        publicKey
      ]);

      // Sign certificate
      const signature = await this.signCertificate(
        certData,
        signingKey.material.key
      );

      const certificate: Certificate = {
        metadata,
        publicKey,
        signature,
        raw: Buffer.concat([certData, signature])
      };

      // Store certificate
      this.certificates.set(metadata.serialNumber, certificate);

      this.emit('certificate-created', {
        serialNumber: metadata.serialNumber,
        subject: metadata.subject
      });

      logger.info('Certificate created', {
        serialNumber: metadata.serialNumber,
        subject: metadata.subject
      });

      return certificate;

    } catch (error) {
      logger.error('Failed to create certificate', { subject }, error as Error);
      throw error;
    }
  }

  async validateCertificate(
    serialNumber: string
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const certificate = this.certificates.get(serialNumber);
      if (!certificate) {
        return { isValid: false, reason: 'Certificate not found' };
      }

      // Check revocation
      if (this.revocationList.has(serialNumber)) {
        return { isValid: false, reason: 'Certificate revoked' };
      }

      // Check validity period
      const now = Date.now();
      if (now < certificate.metadata.notBefore) {
        return { isValid: false, reason: 'Certificate not yet valid' };
      }
      if (now > certificate.metadata.notAfter) {
        return { isValid: false, reason: 'Certificate expired' };
      }

      // Verify signature
      const signingKey = await this.keyManager.getKey(certificate.metadata.keyId);
      if (!signingKey) {
        return { isValid: false, reason: 'Signing key not found' };
      }

      const isSignatureValid = await this.verifySignature(
        certificate.raw.slice(0, -certificate.signature.length),
        certificate.signature,
        signingKey.material.key
      );

      if (!isSignatureValid) {
        return { isValid: false, reason: 'Invalid signature' };
      }

      return { isValid: true };

    } catch (error) {
      logger.error('Failed to validate certificate', { serialNumber }, error as Error);
      throw error;
    }
  }

  async revokeCertificate(serialNumber: string): Promise<void> {
    try {
      const certificate = this.certificates.get(serialNumber);
      if (!certificate) {
        throw new Error(`Certificate not found: ${serialNumber}`);
      }

      // Add to revocation list
      this.revocationList.add(serialNumber);
      certificate.metadata.status = 'revoked';

      this.emit('certificate-revoked', { serialNumber });
      logger.info('Certificate revoked', { serialNumber });

    } catch (error) {
      logger.error('Failed to revoke certificate', { serialNumber }, error as Error);
      throw error;
    }
  }

  getCertificate(serialNumber: string): Certificate | undefined {
    return this.certificates.get(serialNumber);
  }

  listCertificates(): Certificate[] {
    return Array.from(this.certificates.values());
  }

  getRevocationList(): string[] {
    return Array.from(this.revocationList);
  }

  private async getOrCreateSigningKey(): Promise<KeyEntry> {
    // Find active signing key
    for (const key of await this.keyManager.listKeys()) {
      if (
        key.metadata.type === this.config.keyType &&
        key.metadata.status === 'active'
      ) {
        return key;
      }
    }

    // Create new signing key
    return await this.keyManager.createKey(this.config.keyType);
  }

  private generateSerialNumber(): string {
    const random = Buffer.alloc(16);
    random.writeUInt32BE(Date.now(), 0);
    randomFillSync(random, 4);
    return random.toString('hex');
  }

  private calculateFingerprint(publicKey: Buffer): string {
    return createHash('sha256')
      .update(publicKey)
      .digest('hex');
  }

  private async signCertificate(
    data: Buffer,
    signingKey: Buffer
  ): Promise<Buffer> {
    try {
      // Create signature using RSA-SHA256
      const sign = createSign('SHA256');
      sign.update(data);
      const signature = sign.sign({
        key: signingKey,
        type: 'pkcs8',
        format: 'der'
      });

      logger.debug('Certificate signed successfully', {
        dataLength: data.length,
        signatureLength: signature.length
      });

      return signature;
    } catch (error) {
      logger.error('Failed to sign certificate', {}, error as Error);
      throw new Error('Certificate signing failed');
    }
  }

  private async verifySignature(
    data: Buffer,
    signature: Buffer,
    publicKey: Buffer
  ): Promise<boolean> {
    try {
      // Verify signature using RSA-SHA256
      const verify = createVerify('SHA256');
      verify.update(data);
      const isValid = verify.verify({
        key: publicKey,
        type: 'spki',
        format: 'der'
      }, signature);

      logger.debug('Signature verification completed', {
        isValid,
        dataLength: data.length,
        signatureLength: signature.length
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify signature', {}, error as Error);
      return false;
    }
  }

  private async validateCertificates(): Promise<void> {
    const now = Date.now();

    for (const [serialNumber, certificate] of this.certificates.entries()) {
      try {
        if (certificate.metadata.notAfter <= now) {
          certificate.metadata.status = 'expired';
          this.emit('certificate-expired', { serialNumber });
          logger.info('Certificate expired', { serialNumber });
        }
      } catch (error) {
        logger.error(
          'Error validating certificate',
          { serialNumber },
          error as Error
        );
      }
    }
  }

  shutdown(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }
  }
} 