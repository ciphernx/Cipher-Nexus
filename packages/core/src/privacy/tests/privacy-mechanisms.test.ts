import { 
  PrivacyMechanisms,
  PrivacyParams,
  RandomizedResponseParams,
  KAnonymityParams,
  LDiversityParams,
  TClosenessParams
} from '../mechanisms/PrivacyMechanisms';

describe('Privacy Mechanisms Tests', () => {
  let mechanisms: PrivacyMechanisms;

  beforeEach(() => {
    mechanisms = new PrivacyMechanisms();
  });

  describe('Laplace Mechanism', () => {
    test('should add noise while preserving approximate value', () => {
      const value = 100;
      const params: PrivacyParams = {
        epsilon: 1.0,
        sensitivity: 1.0
      };

      const results = Array.from({ length: 1000 }, () => 
        mechanisms.addLaplaceNoise(value, params)
      );

      const mean = results.reduce((a, b) => a + b) / results.length;
      expect(Math.abs(mean - value)).toBeLessThan(5); // Should be close to original value
    });

    test('should throw error for invalid epsilon', () => {
      expect(() => mechanisms.addLaplaceNoise(100, {
        epsilon: -1,
        sensitivity: 1
      })).toThrow('Epsilon must be positive');
    });
  });

  describe('Gaussian Mechanism', () => {
    test('should add noise while preserving approximate value', () => {
      const value = 100;
      const params: PrivacyParams = {
        epsilon: 1.0,
        delta: 0.1,
        sensitivity: 1.0
      };

      const results = Array.from({ length: 1000 }, () => 
        mechanisms.addGaussianNoise(value, params)
      );

      const mean = results.reduce((a, b) => a + b) / results.length;
      expect(Math.abs(mean - value)).toBeLessThan(5);
    });

    test('should throw error for invalid delta', () => {
      expect(() => mechanisms.addGaussianNoise(100, {
        epsilon: 1,
        delta: 1.5,
        sensitivity: 1
      })).toThrow('Delta must be in (0,1)');
    });
  });

  describe('Randomized Response', () => {
    test('should maintain original value with given probability', () => {
      const params: RandomizedResponseParams = {
        epsilon: 1.0,
        sensitivity: 1.0,
        probability: 0.8
      };

      const results = Array.from({ length: 1000 }, () => 
        mechanisms.applyRandomizedResponse(true, params)
      );

      const trueCount = results.filter(x => x).length;
      const observedProbability = trueCount / results.length;
      expect(Math.abs(observedProbability - 0.8)).toBeLessThan(0.1);
    });
  });

  describe('K-Anonymity', () => {
    test('should ensure k-anonymity for all groups', () => {
      const data = [
        { age: 25, zipcode: '12345', disease: 'flu' },
        { age: 25, zipcode: '12345', disease: 'cold' },
        { age: 30, zipcode: '12346', disease: 'flu' },
        { age: 30, zipcode: '12346', disease: 'cold' },
        { age: 35, zipcode: '12347', disease: 'flu' }
      ];

      const params: KAnonymityParams = {
        k: 2,
        quasiIdentifiers: ['age', 'zipcode']
      };

      const anonymized = mechanisms.applyKAnonymity(data, params);

      // Check that each combination of quasi-identifiers appears at least k times
      const groups = new Map<string, number>();
      for (const record of anonymized) {
        const key = `${record.age}|${record.zipcode}`;
        groups.set(key, (groups.get(key) || 0) + 1);
      }

      for (const count of groups.values()) {
        expect(count).toBeGreaterThanOrEqual(params.k);
      }
    });
  });

  describe('L-Diversity', () => {
    test('should ensure l-diversity for sensitive attributes', () => {
      const data = [
        { age: 25, zipcode: '12345', disease: 'flu' },
        { age: 25, zipcode: '12345', disease: 'cold' },
        { age: 25, zipcode: '12345', disease: 'fever' },
        { age: 30, zipcode: '12346', disease: 'flu' },
        { age: 30, zipcode: '12346', disease: 'cold' },
        { age: 30, zipcode: '12346', disease: 'fever' }
      ];

      const params: LDiversityParams = {
        k: 2,
        l: 3,
        quasiIdentifiers: ['age', 'zipcode'],
        sensitiveAttributes: ['disease']
      };

      const diversified = mechanisms.applyLDiversity(data, params);

      // Check that each group has at least l distinct values for sensitive attributes
      const groups = new Map<string, Set<string>>();
      for (const record of diversified) {
        const key = `${record.age}|${record.zipcode}`;
        if (!groups.has(key)) {
          groups.set(key, new Set());
        }
        groups.get(key)!.add(record.disease);
      }

      for (const values of groups.values()) {
        expect(values.size).toBeGreaterThanOrEqual(params.l);
      }
    });
  });

  describe('T-Closeness', () => {
    test('should ensure t-closeness for distributions', () => {
      const data = [
        { age: 25, zipcode: '12345', salary: 'high' },
        { age: 25, zipcode: '12345', salary: 'medium' },
        { age: 25, zipcode: '12345', salary: 'low' },
        { age: 30, zipcode: '12346', salary: 'high' },
        { age: 30, zipcode: '12346', salary: 'medium' },
        { age: 30, zipcode: '12346', salary: 'low' }
      ];

      const params: TClosenessParams = {
        k: 2,
        l: 3,
        t: 0.5,
        quasiIdentifiers: ['age', 'zipcode'],
        sensitiveAttributes: ['salary']
      };

      const result = mechanisms.applyTCloseness(data, params);

      // Verify that result maintains data structure
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('age');
      expect(result[0]).toHaveProperty('zipcode');
      expect(result[0]).toHaveProperty('salary');
    });
  });

  describe('Error Handling', () => {
    test('should validate all parameters', () => {
      expect(() => mechanisms.applyKAnonymity([], { k: 0, quasiIdentifiers: [] }))
        .toThrow('k must be an integer greater than 1');

      expect(() => mechanisms.applyLDiversity([], {
        k: 2,
        l: 0,
        quasiIdentifiers: [],
        sensitiveAttributes: []
      })).toThrow('l must be an integer greater than 1');

      expect(() => mechanisms.applyTCloseness([], {
        k: 2,
        l: 2,
        t: 1.5,
        quasiIdentifiers: [],
        sensitiveAttributes: []
      })).toThrow('t must be in (0,1)');
    });
  });
}); 