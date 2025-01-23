import { Compression, CompressionOptions } from '../storage/compression';

describe('Compression Tests', () => {
  let compression: Compression;

  beforeEach(() => {
    compression = new Compression({
      level: 6,
      threshold: 100
    });
  });

  test('should compress data above threshold', async () => {
    const data = 'x'.repeat(1000); // Create large string
    const compressed = await compression.compress(data);
    
    expect(compressed.length).toBeLessThan(data.length);
  });

  test('should not compress data below threshold', async () => {
    const data = 'small string';
    const compressed = await compression.compress(data);
    
    expect(compressed.length).toBe(Buffer.from(data).length);
  });

  test('should correctly decompress compressed data', async () => {
    const original = 'x'.repeat(1000);
    const compressed = await compression.compress(original);
    const decompressed = await compression.decompress(compressed);
    
    expect(decompressed.toString()).toBe(original);
  });

  test('should handle non-compressed data in decompress', async () => {
    const data = Buffer.from('uncompressed data');
    const result = await compression.decompress(data);
    
    expect(result.toString()).toBe('uncompressed data');
  });

  test('should calculate correct compression ratio', async () => {
    const original = Buffer.from('x'.repeat(1000));
    const compressed = await compression.compress(original);
    const ratio = compression.calculateRatio(original, compressed);
    
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });

  test('should estimate compression savings', async () => {
    const data = 'x'.repeat(1000);
    const stats = await compression.estimateSavings(data);
    
    expect(stats.originalSize).toBe(1000);
    expect(stats.compressedSize).toBeLessThan(stats.originalSize);
    expect(stats.ratio).toBeGreaterThan(0);
    expect(stats.ratio).toBeLessThan(1);
    expect(stats.savings).toBeGreaterThan(0);
  });

  test('should handle different compression levels', async () => {
    const data = 'x'.repeat(1000);
    const maxCompression = new Compression({ level: 9 });
    const minCompression = new Compression({ level: 1 });

    const maxCompressed = await maxCompression.compress(data);
    const minCompressed = await minCompression.compress(data);

    // Higher compression level should result in smaller or equal size
    expect(maxCompressed.length).toBeLessThanOrEqual(minCompressed.length);
  });

  test('should handle Buffer input', async () => {
    const data = Buffer.from('x'.repeat(1000));
    const compressed = await compression.compress(data);
    const decompressed = await compression.decompress(compressed);

    expect(Buffer.compare(decompressed, data)).toBe(0);
  });

  test('should throw error for invalid input', async () => {
    const invalidData = null as any;
    await expect(compression.compress(invalidData))
      .rejects.toThrow();
  });

  test('should throw error for corrupted compressed data', async () => {
    const corrupted = Buffer.from('corrupted data');
    await expect(compression.decompress(corrupted))
      .rejects.toThrow();
  });
}); 