import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Encryption } from '../src/core/encryption';
import { EncryptionConfig } from '../src/types';

use(chaiAsPromised);

describe('Encryption', () => {
  describe('RSA Encryption', () => {
    const config: EncryptionConfig = {
      algorithm: 'RSA',
      keySize: 2048
    };
    let encryption: Encryption;

    beforeEach(() => {
      encryption = new Encryption(config);
    });

    it('should generate RSA key pair', async () => {
      const keys = await encryption.generateKeys();
      expect(keys.publicKey).to.be.a('string');
      expect(keys.privateKey).to.be.a('string');
      expect(keys.publicKey).to.include('BEGIN PUBLIC KEY');
      expect(keys.privateKey).to.include('BEGIN PRIVATE KEY');
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = { message: 'test message' };
      const keys = await encryption.generateKeys();
      
      const encrypted = await encryption.encrypt(testData, keys.publicKey);
      expect(encrypted.data).to.be.a('string');
      
      const decrypted = await encryption.decrypt(encrypted, keys.privateKey);
      expect(decrypted).to.deep.equal(testData);
    });
  });

  describe('AES Encryption', () => {
    const config: EncryptionConfig = {
      algorithm: 'AES',
      keySize: 256,
      mode: 'gcm'
    };
    let encryption: Encryption;

    beforeEach(() => {
      encryption = new Encryption(config);
    });

    it('should generate AES key', async () => {
      const keys = await encryption.generateKeys();
      expect(keys.publicKey).to.be.a('string');
      expect(keys.privateKey).to.be.a('string');
      expect(keys.publicKey).to.have.lengthOf(64); // 256 bits = 64 hex chars
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = { message: 'test message' };
      const keys = await encryption.generateKeys();
      
      const encrypted = await encryption.encrypt(testData, keys.publicKey);
      expect(encrypted.data).to.be.a('string');
      expect(encrypted.iv).to.be.a('string');
      expect(encrypted.tag).to.be.a('string');
      
      const decrypted = await encryption.decrypt(encrypted, keys.privateKey);
      expect(decrypted).to.deep.equal(testData);
    });

    it('should throw error for invalid data', async () => {
      const keys = await encryption.generateKeys();
      const invalidData = { data: 'invalid', iv: 'invalid', tag: 'invalid' };
      
      await expect(encryption.decrypt(invalidData, keys.privateKey))
        .to.be.rejectedWith(Error);
    });
  });
}); 