import { expect } from 'chai';
import { Pedersen, PedersenParams } from '../pedersen';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';

describe('Pedersen', () => {
  let params: PedersenParams;
  let message: BigInteger;
  let randomness: BigInteger;

  before(async () => {
    params = await Pedersen.generateParams(512);
    const messageBuffer = Buffer.from(randomBytes(32));
    const randomnessBuffer = Buffer.from(randomBytes(32));
    message = new BigInteger(messageBuffer.toString('hex'), 16).mod(params.q);
    randomness = new BigInteger(randomnessBuffer.toString('hex'), 16).mod(params.q);
  });

  it('should generate valid parameters', () => {
    expect(params.p).to.exist;
    expect(params.q).to.exist;
    expect(params.g).to.exist;
    expect(params.h).to.exist;
    expect(params.p.bitLength()).to.be.at.least(512);
    expect(params.g.compareTo(BigInteger.ONE)).to.be.above(0);
    expect(params.g.compareTo(params.p)).to.be.below(0);
    expect(params.h.compareTo(BigInteger.ONE)).to.be.above(0);
    expect(params.h.compareTo(params.p)).to.be.below(0);
  });

  it('should generate and verify valid commitments', async () => {
    const commitment = await Pedersen.commit(message, randomness, params);
    const isValid = await Pedersen.verify(commitment, message, randomness, params);
    expect(isValid).to.be.true;
  });

  it('should generate different commitments for the same message', async () => {
    const randomness1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const randomness2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);

    const commitment1 = await Pedersen.commit(message, randomness1, params);
    const commitment2 = await Pedersen.commit(message, randomness2, params);

    expect(commitment1.equals(commitment2)).to.be.false;

    const isValid1 = await Pedersen.verify(commitment1, message, randomness1, params);
    const isValid2 = await Pedersen.verify(commitment2, message, randomness2, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should reject invalid commitments', async () => {
    const commitment = await Pedersen.commit(message, randomness, params);
    const wrongMessage = message.add(BigInteger.ONE).mod(params.q);
    const isValid = await Pedersen.verify(commitment, wrongMessage, randomness, params);
    expect(isValid).to.be.false;
  });

  it('should be homomorphic', async () => {
    const message1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const message2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const randomness1 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);
    const randomness2 = new BigInteger(randomBytes(32).toString('hex'), 16).mod(params.q);

    const commitment1 = await Pedersen.commit(message1, randomness1, params);
    const commitment2 = await Pedersen.commit(message2, randomness2, params);

    const sumMessage = message1.add(message2).mod(params.q);
    const sumRandomness = randomness1.add(randomness2).mod(params.q);
    const sumCommitment = commitment1.multiply(commitment2).mod(params.p);

    const isValid = await Pedersen.verify(sumCommitment, sumMessage, sumRandomness, params);
    expect(isValid).to.be.true;
  });

  it('should handle small values correctly', async () => {
    const smallMessage = new BigInteger('1').mod(params.q);
    const smallRandomness = new BigInteger('1').mod(params.q);
    const commitment = await Pedersen.commit(smallMessage, smallRandomness, params);
    const isValid1 = await Pedersen.verify(commitment, smallMessage, smallRandomness, params);
    expect(isValid1).to.be.true;
  });

  it('should handle maximum values correctly', async () => {
    const maxMessage = params.q.subtract(BigInteger.ONE).mod(params.q);
    const maxRandomness = params.q.subtract(BigInteger.ONE).mod(params.q);
    const commitment = await Pedersen.commit(maxMessage, maxRandomness, params);
    const isValid2 = await Pedersen.verify(commitment, maxMessage, maxRandomness, params);
    expect(isValid2).to.be.true;
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(Pedersen.generateParams(256)).to.be.rejectedWith(Error);
  });

  it('should reject invalid message sizes', async () => {
    const invalidMessage = params.q;
    await expect(
      Pedersen.commit(invalidMessage, randomness, params)
    ).to.be.rejectedWith(Error);
  });

  it('should reject invalid randomness sizes', async () => {
    const invalidRandomness = params.q;
    await expect(
      Pedersen.commit(message, invalidRandomness, params)
    ).to.be.rejectedWith(Error);
  });

  it('should maintain hiding property', async () => {
    const commitment = await Pedersen.commit(message, randomness, params);
    const isValid = await Pedersen.verify(commitment, message, randomness, params);
    expect(isValid).to.be.true;
  });
}); 