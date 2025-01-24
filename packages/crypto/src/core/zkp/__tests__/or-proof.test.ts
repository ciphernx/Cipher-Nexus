import { expect } from 'chai';
import { OrProof, OrProofParams } from '../or-proof';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('OrProof', () => {
  let params: OrProofParams;
  let secret1: BigInteger;
  let secret2: BigInteger;
  let publicValue1: BigInteger;
  let publicValue2: BigInteger;

  before(async () => {
    params = await OrProof.generateParams(512);
    const randomBuffer1 = Buffer.from(randomBytes(32));
    const randomBuffer2 = Buffer.from(randomBytes(32));
    secret1 = new BigInteger(randomBuffer1.toString('hex'), 16);
    secret2 = new BigInteger(randomBuffer2.toString('hex'), 16);
    publicValue1 = secret1.modPow(new BigInteger('2'), params.n1);
    publicValue2 = secret2.modPow(new BigInteger('2'), params.n2);
  });

  it('should generate valid parameters', () => {
    expect(params.n1).to.exist;
    expect(params.n2).to.exist;
    expect(params.n1.bitLength()).to.be.at.least(512);
    expect(params.n2.bitLength()).to.be.at.least(512);
  });

  it('should generate and verify valid proofs with first secret', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const isValid = await OrProof.verify(proof, publicValue1, publicValue2, params);
    expect(isValid).to.be.true;
  });

  it('should generate and verify valid proofs with second secret', async () => {
    const proof = await OrProof.prove(null, secret2, publicValue1, publicValue2, params);
    const isValid = await OrProof.verify(proof, publicValue1, publicValue2, params);
    expect(isValid).to.be.true;
  });

  it('should reject proofs with both secrets', async () => {
    await expect(
      OrProof.prove(secret1, secret2, publicValue1, publicValue2, params)
    ).to.be.rejectedWith(Error);
  });

  it('should reject invalid proofs with wrong secret', async () => {
    const wrongSecret = new BigInteger(randomBytes(32).toString('hex'), 16);
    const proof = await OrProof.prove(wrongSecret, null, publicValue1, publicValue2, params);
    const isValid = await OrProof.verify(proof, publicValue1, publicValue2, params);
    expect(isValid).to.be.false;
  });

  it('should reject invalid proofs with wrong public values', async () => {
    const wrongPublicValue = params.g.modPow(new BigInteger('2'), params.n1);
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const isValid = await OrProof.verify(proof, wrongPublicValue, publicValue2, params);
    expect(isValid).to.be.false;
  });

  it('should generate different proofs for the same values', async () => {
    const proof1 = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const proof2 = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);

    expect(proof1.commitments[0].equals(proof2.commitments[0])).to.be.false;
    expect(proof1.commitments[1].equals(proof2.commitments[1])).to.be.false;

    const isValid1 = await OrProof.verify(proof1, publicValue1, publicValue2, params);
    const isValid2 = await OrProof.verify(proof2, publicValue1, publicValue2, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should maintain zero-knowledge property', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);

    expect(proof.commitments[0].equals(publicValue1)).to.be.false;
    expect(proof.commitments[1].equals(publicValue2)).to.be.false;

    expect(proof.challenges[0].equals(proof.challenges[1])).to.be.false;
  });

  it('should handle small values correctly', async () => {
    const smallSecret = new BigInteger('1');
    const smallPublicValue = params.g.modPow(smallSecret, params.n1);
    const proof = await OrProof.prove(smallSecret, null, smallPublicValue, publicValue2, params);
    const isValidSmall = await OrProof.verify(proof, smallPublicValue, publicValue2, params);
    expect(isValidSmall).to.be.true;
  });

  it('should handle maximum values correctly', async () => {
    const maxSecret = params.n1.subtract(BigInteger.ONE);
    const maxPublicValue = params.g.modPow(maxSecret, params.n1);
    const proof = await OrProof.prove(maxSecret, null, maxPublicValue, publicValue2, params);
    const isValidLarge = await OrProof.verify(proof, maxPublicValue, publicValue2, params);
    expect(isValidLarge).to.be.true;
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(
      OrProof.generateParams(256)
    ).to.be.rejectedWith(Error);
  });

  it('should maintain soundness property', async () => {
    const proof = await OrProof.prove(secret1, null, publicValue1, publicValue2, params);
    const isValidOriginal = await OrProof.verify(proof, publicValue1, publicValue2, params);
    expect(isValidOriginal).to.be.true;

    // Try to forge a proof by modifying challenges
    const forgedProof = {
      ...proof,
      challenges: [proof.challenges[1], proof.challenges[0]] as [Buffer, Buffer]
    };

    const isValidTransferred = await OrProof.verify(forgedProof, publicValue1, publicValue2, params);
    expect(isValidTransferred).to.be.false;
  });
}); 