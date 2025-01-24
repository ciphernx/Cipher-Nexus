import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { PrivacyProtocol } from '../src/core/privacy';
import { PrivacyConfig } from '../src/types';

use(chaiAsPromised);

describe('PrivacyProtocol', () => {
  describe('Basic Encryption', () => {
    const config: PrivacyConfig = {
      encryptionLevel: 'basic',
      useHomomorphicEncryption: false,
      useZeroKnowledgeProof: false
    };
    let protocol: PrivacyProtocol;

    beforeEach(() => {
      protocol = new PrivacyProtocol(config);
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = { message: 'test message' };
      
      const encrypted = await protocol.encrypt(testData);
      expect(encrypted).to.be.an('object');
      
      const decrypted = await protocol.decrypt(encrypted);
      expect(decrypted).to.deep.equal(testData);
    });
  });

  describe('Medium Security', () => {
    const config: PrivacyConfig = {
      encryptionLevel: 'medium',
      useHomomorphicEncryption: false,
      useZeroKnowledgeProof: false
    };
    let protocol: PrivacyProtocol;

    beforeEach(() => {
      protocol = new PrivacyProtocol(config);
    });

    it('should use RSA encryption', async () => {
      const testData = { message: 'test message' };
      
      const encrypted = await protocol.encrypt(testData);
      expect(encrypted).to.be.an('object');
      
      const decrypted = await protocol.decrypt(encrypted);
      expect(decrypted).to.deep.equal(testData);
    });
  });

  describe('High Security', () => {
    const config: PrivacyConfig = {
      encryptionLevel: 'high',
      useHomomorphicEncryption: true,
      useZeroKnowledgeProof: true
    };
    let protocol: PrivacyProtocol;

    beforeEach(() => {
      protocol = new PrivacyProtocol(config);
    });

    it('should throw error for unimplemented FHE', async () => {
      const testData = { message: 'test message' };
      
      await expect(protocol.encrypt(testData))
        .to.be.rejectedWith('Homomorphic encryption not implemented yet');
    });
  });

  describe('Error Handling', () => {
    const config: PrivacyConfig = {
      encryptionLevel: 'basic',
      useHomomorphicEncryption: false,
      useZeroKnowledgeProof: false
    };
    let protocol: PrivacyProtocol;

    beforeEach(() => {
      protocol = new PrivacyProtocol(config);
    });

    it('should handle invalid data gracefully', async () => {
      const invalidData = undefined;
      
      await expect(protocol.encrypt(invalidData))
        .to.be.rejectedWith(Error);
    });

    it('should handle decryption of invalid data', async () => {
      const invalidEncrypted = { data: 'invalid' };
      
      await expect(protocol.decrypt(invalidEncrypted))
        .to.be.rejectedWith(Error);
    });
  });
}); 