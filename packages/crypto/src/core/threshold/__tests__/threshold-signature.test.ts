import { ThresholdSignature, ThresholdParams, ThresholdKeyShare } from '../threshold-signature';
import { BigInteger } from 'jsbn';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

describe('Threshold Signature Scheme', () => {
  const t = 3; // Threshold
  const n = 5; // Total number of participants
  let params: ThresholdParams;
  let dealer: ThresholdSignature;
  let shares: ThresholdKeyShare[];
  const message = 'Hello, Threshold Signature!';

  beforeAll(async () => {
    // Generate parameters with smaller bit size for testing
    params = await ThresholdSignature.generateParams(512);
    dealer = new ThresholdSignature(params);
    
    // Generate shares for all participants
    shares = await dealer.generateShares(t, n);
  });

  it('should generate valid parameters', () => {
    expect(params.p).toBeDefined();
    expect(params.q).toBeDefined();
    expect(params.g).toBeDefined();
    expect(params.p.bitLength()).toBeGreaterThanOrEqual(512);
    expect(params.g.compareTo(BigInteger.ONE)).toBeGreaterThan(0);
    expect(params.g.compareTo(params.p)).toBeLessThan(0);
    
    // Verify that g has order q
    const gPowQ = params.g.modPow(params.q, params.p);
    expect(gPowQ.equals(BigInteger.ONE)).toBe(true);
  });

  it('should generate valid shares', () => {
    expect(shares.length).toBe(n);
    
    // Verify each share
    shares.forEach((share, i) => {
      expect(share.index).toBe(i + 1);
      expect(share.value).toBeDefined();
      expect(share.verification).toBeDefined();
      
      // Verify share is in correct range
      expect(share.value.compareTo(params.q)).toBeLessThan(0);
      expect(share.value.compareTo(BigInteger.ZERO)).toBeGreaterThan(0);
      
      // Verify commitment
      const commitment = params.g.modPow(share.value, params.p);
      expect(commitment.equals(share.verification)).toBe(true);
    });
  });

  it('should verify share validity', async () => {
    // Each participant should be able to verify their share
    for (const share of shares) {
      const isValid = await dealer.verifyShare(share);
      expect(isValid).toBe(true);
    }
  });

  it('should generate partial signatures', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Generate partial signatures
    const partialSigs = await Promise.all(
      shares.slice(0, t).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );

    // Verify each partial signature
    for (let i = 0; i < t; i++) {
      const isValid = await dealer.verifyPartialSignature(
        messageNum,
        partialSigs[i],
        shares[i]
      );
      expect(isValid).toBe(true);
    }
  });

  it('should combine partial signatures correctly', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Generate t partial signatures
    const partialSigs = await Promise.all(
      shares.slice(0, t).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );

    // Combine partial signatures
    const signature = await dealer.combineSignatures(partialSigs, messageNum);

    // Verify combined signature
    const isValid = await dealer.verifySignature(message, signature);
    expect(isValid).toBe(true);
  });

  it('should require exactly t shares to generate valid signature', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Try with t-1 shares (should fail)
    const tooFewSigs = await Promise.all(
      shares.slice(0, t-1).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );

    await expect(dealer.combineSignatures(tooFewSigs, messageNum))
      .rejects
      .toThrow('Insufficient partial signatures');

    // Try with t+1 shares (should work but be redundant)
    const extraSigs = await Promise.all(
      shares.slice(0, t+1).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );

    const signature = await dealer.combineSignatures(extraSigs, messageNum);
    const isValid = await dealer.verifySignature(message, signature);
    expect(isValid).toBe(true);
  });

  it('should handle different combinations of t shares', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Try different combinations of t shares
    const combinations = [
      shares.slice(0, t),
      shares.slice(1, t+1),
      shares.slice(2, t+2),
      [shares[0], shares[2], shares[4]]
    ];

    for (const shareSet of combinations) {
      const partialSigs = await Promise.all(
        shareSet.map(share => 
          dealer.generatePartialSignature(messageNum, share)
        )
      );

      const signature = await dealer.combineSignatures(partialSigs, messageNum);
      const isValid = await dealer.verifySignature(message, signature);
      expect(isValid).toBe(true);
    }
  });

  it('should prevent signature forgery', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Generate partial signatures
    const partialSigs = await Promise.all(
      shares.slice(0, t).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );

    // Modify one partial signature
    const modifiedSigs = [...partialSigs];
    modifiedSigs[0] = {
      ...modifiedSigs[0],
      value: modifiedSigs[0].value.add(BigInteger.ONE)
    };

    // Combine modified signatures
    const signature = await dealer.combineSignatures(modifiedSigs, messageNum);
    const isValid = await dealer.verifySignature(message, signature);
    expect(isValid).toBe(false);
  });

  it('should handle concurrent signature generation', async () => {
    const numMessages = 5;
    const messages = Array(numMessages).fill(null).map((_, i) => `Message ${i}`);
    
    const signatures = await Promise.all(messages.map(async msg => {
      const messageHash = createHash('sha256').update(msg).digest();
      const messageNum = new BigInteger(messageHash.toString('hex'), 16);

      // Generate partial signatures
      const partialSigs = await Promise.all(
        shares.slice(0, t).map(share => 
          dealer.generatePartialSignature(messageNum, share)
        )
      );

      // Combine signatures
      const signature = await dealer.combineSignatures(partialSigs, messageNum);
      return { message: msg, signature };
    }));

    // Verify all signatures
    for (const { message, signature } of signatures) {
      const isValid = await dealer.verifySignature(message, signature);
      expect(isValid).toBe(true);
    }
  });

  it('should reject invalid parameter sizes', async () => {
    await expect(ThresholdSignature.generateParams(256)) // Too small
      .rejects
      .toThrow('Invalid parameter size');
  });

  it('should reject invalid threshold values', async () => {
    await expect(dealer.generateShares(0, n))
      .rejects
      .toThrow('Invalid threshold');

    await expect(dealer.generateShares(n + 1, n))
      .rejects
      .toThrow('Threshold cannot be larger than number of participants');
  });

  it('should be non-malleable', async () => {
    const messageHash = createHash('sha256').update(message).digest();
    const messageNum = new BigInteger(messageHash.toString('hex'), 16);

    // Generate and combine partial signatures
    const partialSigs = await Promise.all(
      shares.slice(0, t).map(share => 
        dealer.generatePartialSignature(messageNum, share)
      )
    );
    const signature = await dealer.combineSignatures(partialSigs, messageNum);

    // Try to create malicious signature
    const maliciousSignature = {
      ...signature,
      r: signature.r.multiply(BigInteger.ONE.add(BigInteger.ONE)).mod(params.q),
      s: signature.s
    };

    const isValid = await dealer.verifySignature(message, maliciousSignature);
    expect(isValid).toBe(false);
  });
}); 