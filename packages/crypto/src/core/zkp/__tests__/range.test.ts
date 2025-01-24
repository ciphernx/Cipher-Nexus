import { expect } from 'chai';
import { RangeProver, RangeProof } from '../range';
import { Schnorr, SchnorrParams } from '../schnorr';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('RangeProver', () => {
  let params: SchnorrParams;
  let value: BigInteger;
  const bits = 8;

  before(async () => {
    params = await Schnorr.generateParams(512);
    const valueBuffer = Buffer.from(randomBytes(Math.ceil(bits / 8)));
    value = new BigInteger(valueBuffer.toString('hex'), 16).mod(new BigInteger('2').pow(bits));
  });

  it('should generate valid parameters', () => {
    expect(params.p).to.exist;
    expect(params.q).to.exist;
    expect(params.g).to.exist;
  });

  it('should generate and verify valid proofs', async () => {
    const proof = await RangeProver.prove(value, bits, params);
    const isValid = await RangeProver.verify(proof, bits, params);
    expect(isValid).to.be.true;
  });

  it('should reject proofs with invalid value size', async () => {
    const invalidValue = new BigInteger('2').pow(bits + 1);
    await expect(
      RangeProver.prove(invalidValue, bits, params)
    ).to.be.rejectedWith(Error);
  });

  it('should reject invalid proofs', async () => {
    const invalidProof = {
      commitments: [params.g],
      challenges: [new BigInteger('1')],
      responses: [new BigInteger('1')],
      finalCommitment: params.g
    };

    const isValid = await RangeProver.verify(invalidProof, bits, params);
    expect(isValid).to.be.false;
  });

  it('should handle zero value correctly', async () => {
    const zeroValue = new BigInteger('0');
    const proof = await RangeProver.prove(zeroValue, bits, params);
    const isValidZero = await RangeProver.verify(proof, bits, params);
    expect(isValidZero).to.be.true;
  });

  it('should handle maximum value correctly', async () => {
    const maxValue = new BigInteger('2').pow(bits).subtract(BigInteger.ONE);
    const proof = await RangeProver.prove(maxValue, bits, params);
    const isValidMax = await RangeProver.verify(proof, bits, params);
    expect(isValidMax).to.be.true;
  });

  it('should generate different proofs for the same value', async () => {
    const proof1 = await RangeProver.prove(value, bits, params);
    const proof2 = await RangeProver.prove(value, bits, params);

    expect(proof1.commitments).to.not.deep.equal(proof2.commitments);
    expect(proof1.challenges).to.not.deep.equal(proof2.challenges);
    expect(proof1.responses).to.not.deep.equal(proof2.responses);

    const isValid1 = await RangeProver.verify(proof1, bits, params);
    const isValid2 = await RangeProver.verify(proof2, bits, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should maintain zero-knowledge property', async () => {
    const proof = await RangeProver.prove(value, bits, params);

    // Check that individual bit commitments don't reveal the bits
    for (let i = 0; i < bits; i++) {
      const bit = value.testBit(i);
      const commitment = proof.commitments[i];
      expect(commitment.equals(new BigInteger(bit ? '1' : '0'))).to.be.false;
    }

    // Check that final commitment doesn't reveal the value
    expect(proof.finalCommitment.equals(value)).to.be.false;
  });

  it('should handle different bit lengths', async () => {
    for (let testBits = 1; testBits <= 16; testBits++) {
      const testBuffer = Buffer.from(randomBytes(Math.ceil(testBits / 8)));
      const testValue = new BigInteger(testBuffer.toString('hex'), 16).mod(new BigInteger('2').pow(testBits));
      const proof = await RangeProver.prove(testValue, testBits, params);
      const isValid = await RangeProver.verify(proof, testBits, params);
      expect(isValid).to.be.true;
      expect(proof.commitments.length).to.equal(testBits);
      expect(proof.challenges.length).to.equal(testBits);
      expect(proof.responses.length).to.equal(testBits);
    }
  });

  it('should reject values outside the range', async () => {
    const outsideValue = new BigInteger('2').pow(bits);
    const proof = await RangeProver.prove(value, bits, params);
    const isValid = await RangeProver.verify(proof, bits, params);
    expect(isValid).to.be.false;
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(
      RangeProver.generateParameters(256)
    ).to.be.rejectedWith(Error);
  });
}); 