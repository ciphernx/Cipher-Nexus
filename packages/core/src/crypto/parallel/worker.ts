import { parentPort, workerData } from 'worker_threads';
import { ParallelTask, ParallelResult } from './ParallelExecutor';
import { BGVEncryption } from '../schemes/BGVEncryption';
import { HomomorphicConfig, HomomorphicScheme } from '../types';
import { KeyManager } from '../KeyManager';
import { FileKeyStorage } from '../storage/FileKeyStorage';

if (!parentPort) {
  throw new Error('This script must be run as a worker');
}

// Initialize encryption instance
const keyStorage = new FileKeyStorage();
const keyManager = new KeyManager(keyStorage);
const config: HomomorphicConfig = {
  scheme: HomomorphicScheme.BGV,
  polyModulusDegree: 8192,
  securityLevel: 128
};
const encryption = new BGVEncryption(config, keyManager);

// Handle incoming tasks
parentPort.on('message', async ({ task }: { task: ParallelTask<any, any> }) => {
  const startTime = Date.now();
  try {
    let result;
    
    switch (task.operation) {
      case 'encrypt':
        result = await encryption.encrypt(task.data, task.params.keyId);
        break;
        
      case 'decrypt':
        result = await encryption.decrypt(task.data, task.params.keyId);
        break;
        
      case 'add':
        result = await encryption.add(task.data[0], task.data[1]);
        break;
        
      case 'multiply':
        result = await encryption.multiply(task.data[0], task.data[1]);
        break;
        
      case 'relinearize':
        result = await encryption.relinearize(task.data);
        break;
        
      case 'rotate':
        result = await encryption.rotate(task.data, task.params.steps);
        break;
        
      case 'rescale':
        result = await encryption.rescale(task.data);
        break;
        
      default:
        throw new Error(`Unsupported operation: ${task.operation}`);
    }

    const response: ParallelResult<any> = {
      result,
      duration: Date.now() - startTime
    };
    
    parentPort!.postMessage(response);
    
  } catch (error) {
    const response: ParallelResult<any> = {
      result: null,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
    
    parentPort!.postMessage(response);
  }
}); 