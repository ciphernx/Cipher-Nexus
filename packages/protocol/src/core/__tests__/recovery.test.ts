import { RecoveryProtocol, RecoveryConfig, RecoveryMessageType } from '../recovery';
import { Session, Message } from '../types';

describe('Recovery Protocol', () => {
  let protocol: RecoveryProtocol;
  let config: RecoveryConfig;
  let session: Session;

  beforeEach(() => {
    config = {
      heartbeatInterval: 1000,
      heartbeatTimeout: 3000,
      checkpointInterval: 5000,
      maxRetries: 3,
      minActiveNodes: 2
    };

    session = {
      id: 'test-session',
      participants: ['node1', 'node2', 'node3'],
      localParticipantId: 'node1',
      startTime: new Date(),
      state: {}
    };

    protocol = new RecoveryProtocol(config);
  });

  afterEach(() => {
    protocol.stop();
  });

  describe('Protocol Lifecycle', () => {
    test('should start and stop correctly', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();

      protocol.on('started', startSpy);
      protocol.on('stopped', stopSpy);

      await protocol.start(session);
      expect(startSpy).toHaveBeenCalledWith({
        sessionId: session.id,
        timestamp: expect.any(Date)
      });

      await protocol.stop();
      expect(stopSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Heartbeat Monitoring', () => {
    test('should detect node failure', async () => {
      const nodeFailedSpy = jest.fn();
      protocol.on('node-failed', nodeFailedSpy);

      await protocol.start(session);

      // Simulate missed heartbeats
      jest.advanceTimersByTime(config.heartbeatTimeout + 1000);

      expect(nodeFailedSpy).toHaveBeenCalledWith({
        nodeId: expect.any(String),
        timestamp: expect.any(Date)
      });
    });

    test('should handle heartbeat messages', async () => {
      const message: Message = {
        type: RecoveryMessageType.HEARTBEAT,
        sender: 'node2',
        receiver: '*',
        content: Buffer.alloc(0),
        timestamp: new Date()
      };

      await protocol.handleMessage(message);
      
      // Verify heartbeat is recorded
      const heartbeatSpy = jest.fn();
      protocol.on('heartbeat-received', heartbeatSpy);
      
      await protocol.handleMessage(message);
      expect(heartbeatSpy).toHaveBeenCalled();
    });
  });

  describe('Checkpointing', () => {
    test('should create and broadcast checkpoints', async () => {
      const checkpointSpy = jest.fn();
      protocol.on('checkpoint-created', checkpointSpy);

      await protocol.start(session);
      
      const testData = Buffer.from('test-checkpoint-data');
      await protocol.createCheckpoint(session, testData);

      expect(checkpointSpy).toHaveBeenCalledWith({
        checkpointId: expect.any(String),
        timestamp: expect.any(Date)
      });
    });

    test('should handle checkpoint messages', async () => {
      const checkpointData = Buffer.from('test-checkpoint-data');
      const message: Message = {
        type: RecoveryMessageType.CHECKPOINT,
        sender: 'node2',
        receiver: '*',
        content: checkpointData,
        timestamp: new Date()
      };

      const checkpointReceivedSpy = jest.fn();
      protocol.on('checkpoint-received', checkpointReceivedSpy);

      await protocol.handleMessage(message);

      expect(checkpointReceivedSpy).toHaveBeenCalledWith({
        checkpointId: expect.any(String),
        sender: message.sender,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Recovery Process', () => {
    test('should initiate recovery for failed node', async () => {
      const recoveryInitiatedSpy = jest.fn();
      protocol.on('recovery-initiated', recoveryInitiatedSpy);

      await protocol.start(session);
      await protocol.initiateRecovery(session, 'node2');

      expect(recoveryInitiatedSpy).toHaveBeenCalledWith({
        failedNodeId: 'node2',
        timestamp: expect.any(Date)
      });
    });

    test('should handle recovery request and response', async () => {
      const requestMessage: Message = {
        type: RecoveryMessageType.RECOVERY_REQUEST,
        sender: 'node2',
        receiver: '*',
        content: Buffer.from('node3'),
        timestamp: new Date()
      };

      const responseMessage: Message = {
        type: RecoveryMessageType.RECOVERY_RESPONSE,
        sender: 'node1',
        receiver: 'node2',
        content: Buffer.from('recovery-data'),
        timestamp: new Date()
      };

      const recoveryCompletedSpy = jest.fn();
      protocol.on('recovery-completed', recoveryCompletedSpy);

      await protocol.handleMessage(requestMessage);
      await protocol.handleMessage(responseMessage);

      expect(recoveryCompletedSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Date)
      });
    });

    test('should prevent multiple concurrent recoveries', async () => {
      await protocol.start(session);
      await protocol.initiateRecovery(session, 'node2');

      await expect(
        protocol.initiateRecovery(session, 'node3')
      ).rejects.toThrow('Recovery already in progress');
    });
  });

  describe('State Synchronization', () => {
    test('should handle state sync messages', async () => {
      const syncMessage: Message = {
        type: RecoveryMessageType.STATE_SYNC,
        sender: 'node2',
        receiver: '*',
        content: Buffer.from('sync-data'),
        timestamp: new Date()
      };

      const stateSyncSpy = jest.fn();
      protocol.on('state-synced', stateSyncSpy);

      await protocol.handleMessage(syncMessage);

      expect(stateSyncSpy).toHaveBeenCalledWith({
        sender: syncMessage.sender,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid checkpoint data', async () => {
      const message: Message = {
        type: RecoveryMessageType.CHECKPOINT,
        sender: 'node2',
        receiver: '*',
        content: Buffer.alloc(0),
        timestamp: new Date()
      };

      await expect(
        protocol.handleMessage(message)
      ).rejects.toThrow('Invalid checkpoint data');
    });

    test('should handle protocol failure when not enough nodes', async () => {
      const protocolFailedSpy = jest.fn();
      protocol.on('protocol-failed', protocolFailedSpy);

      // Simulate multiple node failures
      await protocol.initiateRecovery(session, 'node2');
      await protocol.handleNodeFailure(session, 'node3');

      expect(protocolFailedSpy).toHaveBeenCalledWith({
        reason: 'Not enough active nodes',
        timestamp: expect.any(Date)
      });
    });
  });
}); 