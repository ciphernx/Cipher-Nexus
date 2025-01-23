import { AdvancedCache, CacheConfig } from '../AdvancedCache';

describe('AdvancedCache', () => {
  let cache: AdvancedCache<any>;
  
  beforeEach(() => {
    const config: CacheConfig = {
      maxSize: 1000,
      maxEntries: 10,
      ttl: 1000,
      checkPeriod: 100,
      maxMemoryUsage: 0.9
    };
    cache = new AdvancedCache(config);
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL functionality', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should update access time on get', async () => {
      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 500));
      cache.get('key1'); // Reset last accessed time
      await new Promise(resolve => setTimeout(resolve, 700));
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('size management', () => {
    it('should evict entries when max size is reached', () => {
      const largeValue = Buffer.alloc(600);
      cache.set('key1', largeValue);
      cache.set('key2', largeValue);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
    });

    it('should evict entries when max entries is reached', () => {
      for (let i = 0; i < 15; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.get('key0')).toBeUndefined();
      expect(cache.get('key14')).toBeDefined();
    });
  });

  describe('memory management', () => {
    it('should emit memory-pressure event when memory usage is high', (done) => {
      cache.on('memory-pressure', () => {
        done();
      });

      // Fill cache with large values to trigger memory pressure
      const largeValue = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, largeValue);
      }
    });

    it('should evict entries when memory usage is high', () => {
      const largeValue = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, largeValue);
      }

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeLessThan(0.9);
    });
  });

  describe('hit counting', () => {
    it('should track hit counts', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Force eviction
      const largeValue = Buffer.alloc(800);
      cache.set('key2', largeValue);

      // key1 should survive due to high hit count
      expect(cache.get('key1')).toBeDefined();
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats.entries).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle invalid values gracefully', () => {
      expect(() => {
        cache.set('key1', undefined as any);
      }).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = Array(100).fill(null).map((_, i) => {
        return Promise.all([
          cache.set(`key${i}`, `value${i}`),
          cache.get(`key${i}`),
          cache.delete(`key${i}`)
        ]);
      });

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
}); 