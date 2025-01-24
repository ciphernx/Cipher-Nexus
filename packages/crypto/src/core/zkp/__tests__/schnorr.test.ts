import { expect } from 'chai';
import { BigInteger } from 'jsbn';
import { SchnorrProtocol, SchnorrParams } from '../schnorr';

describe('Schnorr Protocol', () => {
  let protocol: SchnorrProtocol;
  let params: SchnorrParams;
  let secret: BigInteger;

  before(async () => {
    protocol = new SchnorrProtocol();
    params = await SchnorrProtocol.generateParams(512); // Use smaller parameters for testing
    secret = new BigInteger(32, 1, crypto.getRandomValues(new Uint8Array(32)));
  });

  it('should generate valid parameters', () => {
    expect(params.p).to.exist;
    expect(params.q).to.exist;
    expect(params.g).to.exist;
    expect(params.p.bitLength()).to.be.at.least(512);
    expect(params.g.compareTo(BigInteger.ONE)).to.be.above(0);
    expect(params.g.compareTo(params.p)).to.be.below(0);
  });

  it('should generate and verify valid proofs', async () => {
    // Generate proof
    const proof = await protocol.prove(secret, params);
    expect(proof.commitment).to.exist;
    expect(proof.challenge).to.exist;
    expect(proof.response).to.exist;

    // Compute public value
    const publicValue = params.g.modPow(secret, params.p);

    // Verify proof
    const isValid = await protocol.verify(proof, publicValue, params);
    expect(isValid).to.be.true;
  });

  it('should reject invalid proofs', async () => {
    // Generate valid proof
    const proof = await protocol.prove(secret, params);
    const publicValue = params.g.modPow(secret, params.p);

    // Modify proof to make it invalid
    const invalidProof = {
      ...proof,
      response: proof.response.add(BigInteger.ONE)
    };

    // Verify invalid proof
    const isValid = await protocol.verify(invalidProof, publicValue, params);
    expect(isValid).to.be.false;
  });

  it('should generate different proofs for same secret', async () => {
    // Generate two proofs for same secret
    const proof1 = await protocol.prove(secret, params);
    const proof2 = await protocol.prove(secret, params);

    // Verify proofs are different but both valid
    expect(proof1.commitment.equals(proof2.commitment)).to.be.false;
    expect(proof1.challenge.equals(proof2.challenge)).to.be.false;
    expect(proof1.response.equals(proof2.response)).to.be.false;

    const publicValue = params.g.modPow(secret, params.p);
    const isValid1 = await protocol.verify(proof1, publicValue, params);
    const isValid2 = await protocol.verify(proof2, publicValue, params);
    expect(isValid1).to.be.true;
    expect(isValid2).to.be.true;
  });

  it('should reject proofs with invalid parameters', async () => {
    // Try to prove with invalid parameters
    const invalidParams = {
      ...params,
      p: params.p.add(BigInteger.ONE) // Make p not prime
    };

    await expect(protocol.prove(secret, invalidParams)).to.be.rejectedWith(
      'Parameter p must be prime'
    );
  });

  it('should maintain zero-knowledge property', async () => {
    // Generate proof
    const proof = await protocol.prove(secret, params);
    const publicValue = params.g.modPow(secret, params.p);

    // Verify proof components don't reveal secret
    expect(proof.commitment.modPow(secret, params.p).equals(publicValue)).to.be.false;
    expect(proof.challenge.multiply(secret).equals(secret)).to.be.false;
    expect(proof.response.equals(secret)).to.be.false;

    // Verify proof is still valid
    const isValid = await protocol.verify(proof, publicValue, params);
    expect(isValid).to.be.true;
  });
}); 