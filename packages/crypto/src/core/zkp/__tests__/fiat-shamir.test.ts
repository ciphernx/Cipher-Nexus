import { expect } from 'chai';
import { FiatShamir, FiatShamirParams, FiatShamirProof } from '../fiat-shamir';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('FiatShamir', () => {
  let params: FiatShamirParams;
  let secret: BigInteger;
  let publicValue: BigInteger;

  before(async () => {
    params = await FiatShamir.generateParams(512);
    const randomBuffer = Buffer.from(randomBytes(32));
    secret = new BigInteger(randomBuffer.toString('hex'), 16);
    publicValue = secret.modPow(new BigInteger('2'), params.n);
  });

  it('should generate valid parameters', () => {
    expect(params.n).to.exist;
    expect(params.n.bitLength()).to.be.at.least(512);
  });

  it('should generate and verify valid proofs', async () => {
    const proof = await FiatShamir.prove(secret, params);
    const isValid = await FiatShamir.verify(proof, publicValue, params);
    expect(isValid).to.be.true;
  });

  it('should reject invalid proofs with wrong secret', async () => {
    const wrongSecret = new BigInteger(randomBytes(32).toString('hex'), 16);
    const proof = await FiatShamir.prove(wrongSecret, params);
    const isValid = await FiatShamir.verify(proof, publicValue, params);
    expect(isValid).to.be.false;
  });

  it('should reject invalid proofs with wrong public value', async () => {
    const wrongPublicValue = params.g.modPow(new BigInteger('2'), params.n);
    const proof = await FiatShamir.prove(secret, params);
    const isValid = await FiatShamir.verify(proof, wrongPublicValue, params);
    expect(isValid).to.be.false;
  });

  it('should generate different proofs for the same values', async () => {
    const proof1 = await FiatShamir.prove(secret, params);
    const proof2 = await FiatShamir.prove(secret, params);

    expect(proof1.commitment.equals(proof2.commitment)).to.be.false;
    expect(proof1.challenge.equals(proof2.challenge)).to.be.false;
    expect(proof1.response.equals(proof2.response)).to.be.false;

    const isValid1 = await FiatShamir.verify(proof1, publicValue, params);
    const isValid2 = await FiatShamir.verify(proof2, publicValue, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should handle small values correctly', async () => {
    const smallSecret = new BigInteger('1');
    const smallPublicValue = params.g.modPow(smallSecret, params.n);
    const proof = await FiatShamir.prove(smallSecret, params);
    const isValid1 = await FiatShamir.verify(proof, smallPublicValue, params);
    expect(isValid1).to.be.true;
  });

  it('should handle maximum values correctly', async () => {
    const maxSecret = params.n.subtract(BigInteger.ONE);
    const maxPublicValue = params.g.modPow(maxSecret, params.n);
    const proof = await FiatShamir.prove(maxSecret, params);
    const isValidMax = await FiatShamir.verify(proof, maxPublicValue, params);
    expect(isValidMax).to.be.true;
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(FiatShamir.generateParams(256)).to.be.rejectedWith(Error);
  });

  it('should generate unique proofs', async () => {
    const proof1 = await FiatShamir.prove(secret, params);
    const proof2 = await FiatShamir.prove(secret, params);

    expect(proof1).to.not.deep.equal(proof2);

    expect(proof1.commitment.equals(publicValue)).to.be.false;
    expect(proof2.commitment.equals(publicValue)).to.be.false;

    expect(proof1.response.equals(secret)).to.be.false;
    expect(proof2.response.equals(secret)).to.be.false;
  });

  it('should maintain soundness property', async () => {
    const proof = await FiatShamir.prove(secret, params);
    const isValidOriginal = await FiatShamir.verify(proof, publicValue, params);
    expect(isValidOriginal).to.be.true;

    // Try to forge a proof without knowing the secret
    const fakeProof = {
      commitment: params.g.modPow(new BigInteger('123'), params.n),
      challenge: proof.challenge,
      response: proof.response
    };

    const isValidFake = await FiatShamir.verify(fakeProof, publicValue, params);
    expect(isValidFake).to.be.false;
  });
}); 