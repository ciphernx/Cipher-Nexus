import { expect } from 'chai';
import { BigInteger } from 'jsbn';
import { HomomorphicZKP } from '../homomorphic';
import { SchnorrProtocol, SchnorrParams } from '../schnorr';

describe('Homomorphic Zero-Knowledge Proofs', () => {
  let zkp: HomomorphicZKP;
  let params: SchnorrParams;
  let value1: BigInteger;
  let value2: BigInteger;

  before(async () => {
    zkp = new HomomorphicZKP();
    await zkp.initialize();
    params = await SchnorrProtocol.generateParams(512); // Use smaller parameters for testing
    value1 = new BigInteger(32, 1, crypto.getRandomValues(new Uint8Array(32)));
    value2 = new BigInteger(32, 1, crypto.getRandomValues(new Uint8Array(32)));
  });

  describe('Encryption Proofs', () => {
    it('should generate and verify valid encryption proofs', async () => {
      // Generate proof for encrypted value
      const result = await zkp.proveEncryption(value1, params);
      expect(result.ciphertext).to.exist;
      expect(result.proof).to.exist;
      expect(result.publicValue).to.exist;

      // Verify the proof
      const isValid = await zkp.verifyEncryption(
        result.ciphertext,
        result.proof,
        result.publicValue,
        params
      );
      expect(isValid).to.be.true;
    });

    it('should generate different proofs for same value', async () => {
      // Generate two proofs for same value
      const result1 = await zkp.proveEncryption(value1, params);
      const result2 = await zkp.proveEncryption(value1, params);

      // Verify proofs are different but both valid
      expect(Buffer.compare(result1.ciphertext, result2.ciphertext)).to.not.equal(0);
      expect(result1.proof.commitment.equals(result2.proof.commitment)).to.be.false;
      expect(result1.publicValue.equals(result2.publicValue)).to.be.true;

      const isValid1 = await zkp.verifyEncryption(
        result1.ciphertext,
        result1.proof,
        result1.publicValue,
        params
      );
      const isValid2 = await zkp.verifyEncryption(
        result2.ciphertext,
        result2.proof,
        result2.publicValue,
        params
      );
      expect(isValid1).to.be.true;
      expect(isValid2).to.be.true;
    });

    it('should reject invalid proofs', async () => {
      // Generate valid proof
      const result = await zkp.proveEncryption(value1, params);

      // Modify proof to make it invalid
      const invalidProof = {
        ...result.proof,
        response: result.proof.response.add(BigInteger.ONE)
      };

      // Verify invalid proof
      const isValid = await zkp.verifyEncryption(
        result.ciphertext,
        invalidProof,
        result.publicValue,
        params
      );
      expect(isValid).to.be.false;
    });
  });

  describe('Operation Proofs', () => {
    it('should prove and verify addition operation', async () => {
      // Generate encrypted values
      const enc1 = await zkp.proveEncryption(value1, params);
      const enc2 = await zkp.proveEncryption(value2, params);

      // Perform homomorphic addition
      const sum = value1.add(value2).mod(params.q);
      const encSum = await zkp.proveEncryption(sum, params);

      // Generate proof for the addition
      const proof = await zkp.proveOperation(
        'add',
        enc1.ciphertext,
        enc2.ciphertext,
        encSum.ciphertext,
        params
      );

      // Verify the operation proof
      const isValid = await zkp.verifyOperation(
        'add',
        enc1.ciphertext,
        enc2.ciphertext,
        encSum.ciphertext,
        proof,
        params
      );
      expect(isValid).to.be.true;
    });

    it('should prove and verify multiplication operation', async () => {
      // Generate encrypted values
      const enc1 = await zkp.proveEncryption(value1, params);
      const enc2 = await zkp.proveEncryption(value2, params);

      // Perform homomorphic multiplication
      const product = value1.multiply(value2).mod(params.q);
      const encProduct = await zkp.proveEncryption(product, params);

      // Generate proof for the multiplication
      const proof = await zkp.proveOperation(
        'mul',
        enc1.ciphertext,
        enc2.ciphertext,
        encProduct.ciphertext,
        params
      );

      // Verify the operation proof
      const isValid = await zkp.verifyOperation(
        'mul',
        enc1.ciphertext,
        enc2.ciphertext,
        encProduct.ciphertext,
        proof,
        params
      );
      expect(isValid).to.be.true;
    });

    it('should reject invalid operation proofs', async () => {
      // Generate encrypted values
      const enc1 = await zkp.proveEncryption(value1, params);
      const enc2 = await zkp.proveEncryption(value2, params);

      // Use wrong result
      const wrongSum = value1.subtract(value2).mod(params.q); // Subtraction instead of addition
      const encWrongSum = await zkp.proveEncryption(wrongSum, params);

      // Generate proof for the operation
      const proof = await zkp.proveOperation(
        'add',
        enc1.ciphertext,
        enc2.ciphertext,
        encWrongSum.ciphertext,
        params
      );

      // Verify the operation proof
      const isValid = await zkp.verifyOperation(
        'add',
        enc1.ciphertext,
        enc2.ciphertext,
        encWrongSum.ciphertext,
        proof,
        params
      );
      expect(isValid).to.be.false;
    });

    it('should reject proofs with invalid ciphertexts', async () => {
      // Generate encrypted values
      const enc1 = await zkp.proveEncryption(value1, params);
      const enc2 = await zkp.proveEncryption(value2, params);

      // Create invalid ciphertext
      const invalidCiphertext = Buffer.from('invalid');

      // Try to generate proof with invalid ciphertext
      await expect(
        zkp.proveOperation(
          'add',
          invalidCiphertext,
          enc2.ciphertext,
          enc1.ciphertext,
          params
        )
      ).to.be.rejectedWith('Invalid ciphertext format');

      // Try to verify with invalid ciphertext
      const proof = await zkp.proveOperation(
        'add',
        enc1.ciphertext,
        enc2.ciphertext,
        enc1.ciphertext,
        params
      );
      const isValid = await zkp.verifyOperation(
        'add',
        invalidCiphertext,
        enc2.ciphertext,
        enc1.ciphertext,
        proof,
        params
      );
      expect(isValid).to.be.false;
    });
  });
}); 