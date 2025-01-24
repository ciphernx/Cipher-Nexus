import { FHE, FHEParams, FHECiphertext, FHEKeyPair } from './fhe';
import { KeySwitcher } from './keyswitch';

/**
 * Advanced homomorphic operations and protocols
 */
export class AdvancedFHE extends FHE {
  private keySwitcher: KeySwitcher;

  constructor(
    params: FHEParams,
    primes: bigint[]
  ) {
    super(params);
    this.keySwitcher = new KeySwitcher(params, primes);
  }

  /**
   * Rotate ciphertext elements (cyclic shift)
   */
  public async rotate(
    ciphertext: FHECiphertext,
    steps: number,
    rotationKeys: Buffer
  ): Promise<FHECiphertext> {
    const c0 = this.bufferToPolynomial(ciphertext.c0);
    const c1 = this.bufferToPolynomial(ciphertext.c1);
    
    // Perform rotation
    const rotatedC0 = this.rotatePolynomial(c0, steps);
    const rotatedC1 = this.rotatePolynomial(c1, steps);
    
    // Key switch back to original key
    return await this.keySwitcher.keySwitch(
      {
        c0: this.polynomialToBuffer(rotatedC0),
        c1: this.polynomialToBuffer(rotatedC1)
      },
      rotationKeys
    );
  }

  /**
   * Matrix multiplication with encrypted matrices
   */
  public async matrixMultiply(
    matrix1: FHECiphertext[][],
    matrix2: FHECiphertext[][],
    evaluationKey: Buffer
  ): Promise<FHECiphertext[][]> {
    const rows = matrix1.length;
    const cols = matrix2[0].length;
    const inner = matrix2.length;
    
    const result: FHECiphertext[][] = Array(rows).fill(0).map(() => 
      Array(cols).fill(null)
    );
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let sum = await this.encrypt(0n, evaluationKey);
        
        for (let k = 0; k < inner; k++) {
          const product = await this.multiply(
            matrix1[i][k],
            matrix2[k][j],
            evaluationKey
          );
          sum = await this.add(sum, product);
        }
        
        result[i][j] = sum;
      }
    }
    
    return result;
  }

  /**
   * Compute sigmoid function on encrypted data
   */
  public async sigmoid(
    x: FHECiphertext,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    // Approximate sigmoid using polynomial
    const coefficients = [
      0.5n,                    // constant term
      0.197n,                  // x
      -0.004n,                // x^2
      0.00006n                // x^3
    ];
    
    return await this.evaluatePolynomial(x, coefficients, evaluationKey);
  }

  /**
   * Secure aggregation protocol
   */
  public async secureAggregate(
    ciphertexts: FHECiphertext[],
    weights: bigint[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    if (ciphertexts.length !== weights.length) {
      throw new Error('Number of ciphertexts must match number of weights');
    }
    
    let result = await this.encrypt(0n, evaluationKey);
    
    for (let i = 0; i < ciphertexts.length; i++) {
      const weighted = await this.scalarMultiply(
        ciphertexts[i],
        weights[i],
        evaluationKey
      );
      result = await this.add(result, weighted);
    }
    
    return result;
  }

  /**
   * Private information retrieval
   */
  public async privateRetrieve(
    index: number,
    database: FHECiphertext[],
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    const n = database.length;
    const selectionVector = new Array(n).fill(0n);
    selectionVector[index] = 1n;
    
    let result = await this.encrypt(0n, evaluationKey);
    
    for (let i = 0; i < n; i++) {
      const term = await this.scalarMultiply(
        database[i],
        selectionVector[i],
        evaluationKey
      );
      result = await this.add(result, term);
    }
    
    return result;
  }

  /**
   * Secure comparison protocol
   */
  public async compare(
    a: FHECiphertext,
    b: FHECiphertext,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    // Compute a - b
    const diff = await this.subtract(a, b);
    
    // Approximate sign function using polynomial
    const coefficients = [
      0n,                     // constant term
      1n,                     // x
      -0.2n,                 // x^2
      0.04n                  // x^3
    ];
    
    return await this.evaluatePolynomial(diff, coefficients, evaluationKey);
  }

  /**
   * Generate rotation keys for all possible rotations
   */
  public async generateRotationKeys(keyPair: FHEKeyPair): Promise<Buffer[]> {
    const rotationKeys: Buffer[] = [];
    
    for (let i = 1; i < this.params.n; i++) {
      const rotatedKey = this.rotatePolynomial(
        this.bufferToPolynomial(keyPair.secretKey),
        i
      );
      
      const switchingKey = await this.keySwitcher.generateKeySwitchingKey(
        this.polynomialToBuffer(rotatedKey),
        keyPair.secretKey
      );
      
      rotationKeys.push(switchingKey);
    }
    
    return rotationKeys;
  }

  // Helper methods
  private rotatePolynomial(poly: bigint[], steps: number): bigint[] {
    steps = ((steps % this.params.n) + this.params.n) % this.params.n;
    return [...poly.slice(steps), ...poly.slice(0, steps)];
  }

  public async subtract(a: FHECiphertext, b: FHECiphertext): Promise<FHECiphertext> {
    const negB = {
      c0: this.polynomialToBuffer(
        this.polynomialNegate(this.bufferToPolynomial(b.c0))
      ),
      c1: this.polynomialToBuffer(
        this.polynomialNegate(this.bufferToPolynomial(b.c1))
      )
    };
    
    return await this.add(a, negB);
  }

  public async scalarMultiply(
    ct: FHECiphertext,
    scalar: bigint,
    evaluationKey: Buffer
  ): Promise<FHECiphertext> {
    return {
      c0: this.polynomialToBuffer(
        this.polynomialScalarMultiply(
          this.bufferToPolynomial(ct.c0),
          scalar
        )
      ),
      c1: this.polynomialToBuffer(
        this.polynomialScalarMultiply(
          this.bufferToPolynomial(ct.c1),
          scalar
        )
      )
    };
  }

  private polynomialScalarMultiply(poly: bigint[], scalar: bigint): bigint[] {
    return poly.map(x => (x * scalar) % this.params.q);
  }

  public cleanup() {
    this.keySwitcher.cleanup();
  }
} 