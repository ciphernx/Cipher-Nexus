import { ParallelExecutor, ParallelTask } from '../ParallelExecutor';
import { join } from 'path';

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;
  const workerScript = join(__dirname, '../worker.js');

  beforeEach(() => {
    executor = new ParallelExecutor({
      maxWorkers: 2,
      minBatchSize: 4,
      enableThreadPool: true
    });
  });

  afterEach(async () => {
    await executor.terminate();
  });

  describe('executeParallel', () => {
    it('should process tasks in parallel when batch size is large enough', async () => {
      const tasks: ParallelTask<number[], number[]>[] = [
        { data: [1, 2], operation: 'encrypt', params: { keyId: 'test-key' } },
        { data: [3, 4], operation: 'encrypt', params: { keyId: 'test-key' } },
        { data: [5, 6], operation: 'encrypt', params: { keyId: 'test-key' } },
        { data: [7, 8], operation: 'encrypt', params: { keyId: 'test-key' } }
      ];

      const results = await executor.executeParallel(tasks, workerScript);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toHaveProperty('duration');
        expect(result.error).toBeUndefined();
      });
    });

    it('should process tasks sequentially when batch size is small', async () => {
      const tasks: ParallelTask<number[], number[]>[] = [
        { data: [1, 2], operation: 'encrypt', params: { keyId: 'test-key' } },
        { data: [3, 4], operation: 'encrypt', params: { keyId: 'test-key' } }
      ];

      const results = await executor.executeParallel(tasks, workerScript);
      
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toHaveProperty('duration');
        expect(result.error).toBeUndefined();
      });
    });

    it('should handle errors in tasks', async () => {
      const tasks: ParallelTask<number[], number[]>[] = [
        { data: [1, 2], operation: 'invalid', params: { keyId: 'test-key' } },
        { data: [3, 4], operation: 'encrypt', params: { keyId: 'test-key' } }
      ];

      const results = await executor.executeParallel(tasks, workerScript);
      
      expect(results).toHaveLength(2);
      expect(results[0].error).toContain('Unsupported operation');
      expect(results[1].error).toBeUndefined();
    });
  });

  describe('executeTask', () => {
    it('should execute a single task using worker pool', async () => {
      const task: ParallelTask<number[], number[]> = {
        data: [1, 2],
        operation: 'encrypt',
        params: { keyId: 'test-key' }
      };

      const result = await executor.executeTask(task);
      
      expect(result).toHaveProperty('duration');
      expect(result.error).toBeUndefined();
    });

    it('should handle task errors', async () => {
      const task: ParallelTask<number[], number[]> = {
        data: [1, 2],
        operation: 'invalid',
        params: { keyId: 'test-key' }
      };

      const result = await executor.executeTask(task);
      
      expect(result.error).toContain('Unsupported operation');
    });

    it('should queue tasks when no workers are available', async () => {
      const tasks = Array(5).fill(null).map(() => ({
        data: [1, 2],
        operation: 'encrypt',
        params: { keyId: 'test-key' }
      }));

      const results = await Promise.all(
        tasks.map(task => executor.executeTask(task))
      );
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('duration');
        expect(result.error).toBeUndefined();
      });
    });
  });
}); 