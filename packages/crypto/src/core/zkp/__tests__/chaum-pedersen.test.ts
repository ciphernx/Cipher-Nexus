import { expect } from 'chai';
import { ChaumPedersen, ChaumPedersenParams, ChaumPedersenProof } from '../chaum-pedersen';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('ChaumPedersen', () => {
  let params: ChaumPedersenParams;
  let secret: BigInteger;
  let y1: BigInteger;
  let y2: BigInteger;

  before(async () => {
    params = await ChaumPedersen.generateParams(512);
    const randomBuffer = Buffer.from(randomBytes(32));
    secret = new BigInteger(randomBuffer.toString('hex'), 16);
    y1 = params.g.modPow(secret, params.p);
    y2 = params.h.modPow(secret, params.p);
  });

  it('should generate valid parameters', () => {
    expect(params.p).to.exist;
    expect(params.q).to.exist;
    expect(params.g).to.exist;
    expect(params.h).to.exist;
    expect(params.g.modPow(params.q, params.p).equals(new BigInteger('1'))).to.be.true;
    expect(params.h.modPow(params.q, params.p).equals(new BigInteger('1'))).to.be.true;
  });

  it('should generate and verify valid proofs', async () => {
    const proof = await ChaumPedersen.prove(secret, y1, y2, params);
    const isValid = await ChaumPedersen.verify(y1, y2, proof, params);
    expect(isValid).to.be.true;
  });

  it('should reject invalid proofs with wrong secret', async () => {
    const wrongSecret = new BigInteger(randomBytes(32).toString('hex'), 16);
    const proof = await ChaumPedersen.prove(wrongSecret, y1, y2, params);
    const isValid = await ChaumPedersen.verify(y1, y2, proof, params);
    expect(isValid).to.be.false;
  });

  it('should reject invalid proofs with wrong public values', async () => {
    const wrongY1 = params.g.modPow(new BigInteger('2'), params.p);
    const wrongY2 = params.h.modPow(new BigInteger('2'), params.p);
    const proof = await ChaumPedersen.prove(secret, y1, y2, params);
    const isValid = await ChaumPedersen.verify(wrongY1, wrongY2, proof, params);
    expect(isValid).to.be.false;
  });

  it('should generate different proofs for the same values', async () => {
    const proof1 = await ChaumPedersen.prove(secret, y1, y2, params);
    const proof2 = await ChaumPedersen.prove(secret, y1, y2, params);

    expect(proof1.t1.equals(proof2.t1)).to.be.false;
    expect(proof1.t2.equals(proof2.t2)).to.be.false;

    const isValid1 = await ChaumPedersen.verify(y1, y2, proof1, params);
    const isValid2 = await ChaumPedersen.verify(y1, y2, proof2, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should handle small values correctly', async () => {
    const smallSecret = new BigInteger('1');
    const y1Small = params.g.modPow(smallSecret, params.p);
    const y2Small = params.h.modPow(smallSecret, params.p);
    const proof = await ChaumPedersen.prove(smallSecret, y1Small, y2Small, params);
    const isValid1 = await ChaumPedersen.verify(y1Small, y2Small, proof, params);
    expect(isValid1).to.be.true;
  });

  it('should handle maximum values correctly', async () => {
    const maxSecret = params.q.subtract(BigInteger.ONE);
    const y1Max = params.g.modPow(maxSecret, params.p);
    const y2Max = params.h.modPow(maxSecret, params.p);
    const proof = await ChaumPedersen.prove(maxSecret, y1Max, y2Max, params);
    const isValidMax = await ChaumPedersen.verify(y1Max, y2Max, proof, params);
    expect(isValidMax).to.be.true;
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(ChaumPedersen.generateParams(256)).to.be.rejectedWith(Error);
  });

  it('should reject invalid secrets', async () => {
    const invalidSecret = params.q;
    await expect(ChaumPedersen.prove(invalidSecret, y1, y2, params)).to.be.rejectedWith(Error);
  });

  it('should generate unique proofs', async () => {
    const proof1 = await ChaumPedersen.prove(secret, y1, y2, params);
    const proof2 = await ChaumPedersen.prove(secret, y1, y2, params);

    expect(proof1).to.not.deep.equal(proof2);

    expect(proof1.t1.equals(y1)).to.be.false;
    expect(proof1.t2.equals(y2)).to.be.false;
    expect(proof2.t1.equals(y1)).to.be.false;
    expect(proof2.t2.equals(y2)).to.be.false;
  });
}); 