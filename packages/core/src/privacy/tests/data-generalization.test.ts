import {
  DataGeneralization,
  GeneralizationStrategy,
  GeneralizationRule
} from '../mechanisms/DataGeneralization';

describe('Data Generalization Tests', () => {
  let generalization: DataGeneralization;

  beforeEach(() => {
    generalization = new DataGeneralization();
  });

  describe('Rounding Strategy', () => {
    test('should round numbers with specified precision', () => {
      const rule: GeneralizationRule = {
        attribute: 'salary',
        strategy: GeneralizationStrategy.ROUNDING,
        params: {
          precision: 3,
          roundingBase: 1000
        }
      };

      generalization.addRule(rule);

      const data = [
        { salary: 45678.12345, name: 'John' },
        { salary: 78912.98765, name: 'Jane' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].salary).toBe(46000);
      expect(result[1].salary).toBe(79000);
      expect(result[0].name).toBe('John'); // Unaffected field
    });

    test('should throw error for invalid rounding parameters', () => {
      const rule: GeneralizationRule = {
        attribute: 'salary',
        strategy: GeneralizationStrategy.ROUNDING,
        params: {
          precision: -1
        }
      };

      expect(() => generalization.addRule(rule))
        .toThrow('Precision must be non-negative');
    });
  });

  describe('Binning Strategy', () => {
    test('should assign values to correct bins', () => {
      const rule: GeneralizationRule = {
        attribute: 'age',
        strategy: GeneralizationStrategy.BINNING,
        params: {
          bins: [20, 40, 60],
          binLabels: ['0-20', '21-40', '41-60', '60+']
        }
      };

      generalization.addRule(rule);

      const data = [
        { age: 15, name: 'Young' },
        { age: 35, name: 'Adult' },
        { age: 55, name: 'Middle' },
        { age: 75, name: 'Senior' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].age).toBe('0-20');
      expect(result[1].age).toBe('21-40');
      expect(result[2].age).toBe('41-60');
      expect(result[3].age).toBe('60+');
    });

    test('should throw error for invalid binning parameters', () => {
      const rule: GeneralizationRule = {
        attribute: 'age',
        strategy: GeneralizationStrategy.BINNING,
        params: {
          bins: [20, 40],
          binLabels: ['0-20', '21-40'] // Missing one label
        }
      };

      expect(() => generalization.addRule(rule))
        .toThrow('Number of bin labels must be equal to number of bins + 1');
    });
  });

  describe('Masking Strategy', () => {
    test('should mask string values correctly', () => {
      const rule: GeneralizationRule = {
        attribute: 'ssn',
        strategy: GeneralizationStrategy.MASKING,
        params: {
          maskChar: '*',
          keepFirstN: 3,
          keepLastN: 4
        }
      };

      generalization.addRule(rule);

      const data = [
        { ssn: '123456789', name: 'Test' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].ssn).toBe('123**6789');
    });

    test('should handle short strings in masking', () => {
      const rule: GeneralizationRule = {
        attribute: 'code',
        strategy: GeneralizationStrategy.MASKING,
        params: {
          keepFirstN: 2,
          keepLastN: 2
        }
      };

      generalization.addRule(rule);

      const data = [
        { code: 'ABC', name: 'Short' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].code).toBe('ABC'); // Too short to mask
    });
  });

  describe('Categorization Strategy', () => {
    test('should categorize values according to mapping', () => {
      const categories = new Map([
        ['1', 'Low'],
        ['2', 'Medium'],
        ['3', 'High']
      ]);

      const rule: GeneralizationRule = {
        attribute: 'risk',
        strategy: GeneralizationStrategy.CATEGORIZATION,
        params: {
          categories,
          defaultCategory: 'Unknown'
        }
      };

      generalization.addRule(rule);

      const data = [
        { risk: '1', name: 'Test1' },
        { risk: '2', name: 'Test2' },
        { risk: '3', name: 'Test3' },
        { risk: '4', name: 'Test4' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].risk).toBe('Low');
      expect(result[1].risk).toBe('Medium');
      expect(result[2].risk).toBe('High');
      expect(result[3].risk).toBe('Unknown');
    });
  });

  describe('Custom Function Strategy', () => {
    test('should apply custom generalization function', () => {
      const rule: GeneralizationRule = {
        attribute: 'email',
        strategy: GeneralizationStrategy.MASKING,
        params: {
          customFunction: (email: string) => {
            const [local, domain] = email.split('@');
            return `${local[0]}***@${domain}`;
          }
        }
      };

      generalization.addRule(rule);

      const data = [
        { email: 'john.doe@example.com', name: 'John' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].email).toBe('j***@example.com');
    });
  });

  describe('Multiple Rules', () => {
    test('should apply multiple generalization rules', () => {
      const ageRule: GeneralizationRule = {
        attribute: 'age',
        strategy: GeneralizationStrategy.ROUNDING,
        params: { roundingBase: 5 }
      };

      const nameRule: GeneralizationRule = {
        attribute: 'name',
        strategy: GeneralizationStrategy.MASKING,
        params: {
          keepFirstN: 1,
          keepLastN: 0,
          maskChar: '*'
        }
      };

      generalization.addRule(ageRule);
      generalization.addRule(nameRule);

      const data = [
        { age: 23, name: 'John' },
        { age: 27, name: 'Jane' }
      ];

      const result = generalization.applyGeneralization(data);
      expect(result[0].age).toBe(25);
      expect(result[0].name).toBe('J***');
      expect(result[1].age).toBe(25);
      expect(result[1].name).toBe('J***');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing attributes gracefully', () => {
      const rule: GeneralizationRule = {
        attribute: 'nonexistent',
        strategy: GeneralizationStrategy.SUPPRESSION,
        params: {}
      };

      generalization.addRule(rule);

      const data = [{ name: 'Test' }];
      const result = generalization.applyGeneralization(data);
      expect(result).toEqual(data);
    });

    test('should validate rule parameters', () => {
      const invalidRule: GeneralizationRule = {
        attribute: '',
        strategy: GeneralizationStrategy.SUPPRESSION,
        params: {}
      };

      expect(() => generalization.addRule(invalidRule))
        .toThrow('Invalid generalization rule: missing required fields');
    });
  });
}); 