import { Buffer } from 'buffer';
import { MPCProtocol, MPCMessageType, MPCComputationType } from '../mpc';
import { Participant, Message } from '../types';

describe('Secure Multi-Party Computation Protocol', () => {
  let protocol1: MPCProtocol;
  let protocol2: MPCProtocol;
  let protocol3: MPCProtocol;
  let participants: Participant[];
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants
    participants = [
      {
        id: 'participant1',
        publicKey: Buffer.from('participant1-public-key')
      },
      {
        id: 'participant2',
        publicKey: Buffer.from('participant2-public-key')
      },
      {
        id: 'participant3',
        publicKey: Buffer.from('participant3-public-key')
      }
    ];

    // Create protocol instances
    protocol1 = new MPCProtocol();
    protocol2 = new MPCProtocol();
    protocol3 = new MPCProtocol();

    // Set up message handlers
    protocol1.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[1].id) {
        await protocol2.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participants[2].id) {
        await protocol3.sendMessage(message);
      }
    });

    protocol2.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[0].id) {
        await protocol1.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participants[2].id) {
        await protocol3.sendMessage(message);
      }
    });

    protocol3.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[0].id) {
        await protocol1.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participants[1].id) {
        await protocol2.sendMessage(message);
      }
    });
  });

  it('should initialize and start correctly', async () => {
    await protocol1.initialize();
    await protocol1.start();
    expect(protocol1['state'].isInitialized).toBe(true);
    expect(protocol1['state'].isRunning).toBe(true);
  });

  it('should create session with participants', async () => {
    await protocol1.initialize();
    await protocol1.start();

    const session = await protocol1.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(3);
    expect(session.startTime).toBeDefined();
  });

  it('should compute sum correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    await protocol2.startComputation(MPCComputationType.SUM);
    await protocol3.startComputation(MPCComputationType.SUM);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(30); // 5 + 10 + 15 = 30
    expect(result2![0]).toBe(30);
    expect(result3![0]).toBe(30);
  });

  it('should compute average correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([6]));
    protocol2.setLocalValue(Buffer.from([9]));
    protocol3.setLocalValue(Buffer.from([12]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.AVERAGE);
    await protocol2.startComputation(MPCComputationType.AVERAGE);
    await protocol3.startComputation(MPCComputationType.AVERAGE);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(9); // (6 + 9 + 12) / 3 = 9
    expect(result2![0]).toBe(9);
    expect(result3![0]).toBe(9);
  });

  it('should handle invalid states', async () => {
    await protocol1.initialize();
    await protocol1.start();

    // Try to start computation without setting local value
    await expect(protocol1.startComputation(MPCComputationType.SUM))
      .rejects.toThrow('Local value not set');

    // Try to get result without active session
    expect(protocol1.getResult()).toBeUndefined();
  });

  it('should handle participant leaving during computation', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    await protocol2.startComputation(MPCComputationType.SUM);

    // Participant 3 leaves before starting computation
    await protocol3.leaveSession(session.id);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that computation is not complete
    expect(protocol1.isComplete()).toBe(false);
    expect(protocol2.isComplete()).toBe(false);
    expect(protocol3.isComplete()).toBe(false);
  });

  it('should compute median correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([4]));
    protocol2.setLocalValue(Buffer.from([7]));
    protocol3.setLocalValue(Buffer.from([10]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.MEDIAN);
    await protocol2.startComputation(MPCComputationType.MEDIAN);
    await protocol3.startComputation(MPCComputationType.MEDIAN);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(7); // median of [4, 7, 10]
    expect(result2![0]).toBe(7);
    expect(result3![0]).toBe(7);
  });

  it('should compute variance correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([2]));
    protocol2.setLocalValue(Buffer.from([4]));
    protocol3.setLocalValue(Buffer.from([6]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.VARIANCE);
    await protocol2.startComputation(MPCComputationType.VARIANCE);
    await protocol3.startComputation(MPCComputationType.VARIANCE);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(4); // variance of [2, 4, 6]
    expect(result2![0]).toBe(4);
    expect(result3![0]).toBe(4);
  });

  it('should handle recovery when participant leaves', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    await protocol2.startComputation(MPCComputationType.SUM);
    await protocol3.startComputation(MPCComputationType.SUM);

    // Participant 3 leaves during computation
    await protocol3.leaveSession(session.id);

    // Wait for recovery to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify that computation completed successfully after recovery
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1![0]).toBe(30); // 5 + 10 + 15 = 30
    expect(result2![0]).toBe(30);
  });

  it('should maintain threshold security', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    await protocol2.startComputation(MPCComputationType.SUM);

    // Two participants leave (exceeds threshold)
    await protocol2.leaveSession(session.id);
    await protocol3.leaveSession(session.id);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that computation cannot complete with insufficient participants
    expect(protocol1.isComplete()).toBe(false);
    expect(protocol1.getResult()).toBeUndefined();
  });

  it('should compute mode correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values with a clear mode
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([5]));
    protocol3.setLocalValue(Buffer.from([3]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.MODE);
    await protocol2.startComputation(MPCComputationType.MODE);
    await protocol3.startComputation(MPCComputationType.MODE);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(5); // mode of [5, 5, 3] is 5
    expect(result2![0]).toBe(5);
    expect(result3![0]).toBe(5);
  });

  it('should compute standard deviation correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([2]));
    protocol2.setLocalValue(Buffer.from([4]));
    protocol3.setLocalValue(Buffer.from([6]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.STD_DEV);
    await protocol2.startComputation(MPCComputationType.STD_DEV);
    await protocol3.startComputation(MPCComputationType.STD_DEV);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(2); // std dev of [2, 4, 6] is 2
    expect(result2![0]).toBe(2);
    expect(result3![0]).toBe(2);
  });

  it('should compute range correctly', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([1]));
    protocol2.setLocalValue(Buffer.from([5]));
    protocol3.setLocalValue(Buffer.from([9]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.RANGE);
    await protocol2.startComputation(MPCComputationType.RANGE);
    await protocol3.startComputation(MPCComputationType.RANGE);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify results
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    const result2 = protocol2.getResult();
    const result3 = protocol3.getResult();

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
    expect(result1![0]).toBe(8); // range of [1, 5, 9] is 8
    expect(result2![0]).toBe(8);
    expect(result3![0]).toBe(8);
  });

  it('should validate data integrity', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    await protocol2.startComputation(MPCComputationType.SUM);
    await protocol3.startComputation(MPCComputationType.SUM);

    // Wait for computation to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that computation completed successfully with integrity checks
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
    expect(protocol3.isComplete()).toBe(true);

    const result1 = protocol1.getResult();
    expect(result1).toBeDefined();
    expect(result1![0]).toBe(30);
  });

  it('should enforce threshold security', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize(),
      protocol3.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start(),
      protocol3.start()
    ]);

    const session = await protocol1.createSession(participants);
    await Promise.all([
      protocol2.joinSession(session.id),
      protocol3.joinSession(session.id)
    ]);

    // Set local values
    protocol1.setLocalValue(Buffer.from([5]));
    protocol2.setLocalValue(Buffer.from([10]));
    protocol3.setLocalValue(Buffer.from([15]));

    // Start computation
    await protocol1.startComputation(MPCComputationType.SUM);
    
    // Simulate two participants leaving (below threshold)
    await protocol2.leaveSession(session.id);
    await protocol3.leaveSession(session.id);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that computation cannot complete with insufficient participants
    expect(protocol1.isComplete()).toBe(false);
    expect(protocol1.getResult()).toBeUndefined();
  });
}); 