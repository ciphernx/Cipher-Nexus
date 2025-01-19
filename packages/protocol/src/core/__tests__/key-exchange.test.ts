import { Buffer } from 'buffer';
import { KeyExchangeProtocol } from '../key-exchange';
import { Participant, Message } from '../types';

describe('Key Exchange Protocol', () => {
  let protocol1: KeyExchangeProtocol;
  let protocol2: KeyExchangeProtocol;
  let participant1: Participant;
  let participant2: Participant;
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants
    participant1 = {
      id: 'participant1',
      publicKey: Buffer.from('participant1-public-key')
    };

    participant2 = {
      id: 'participant2',
      publicKey: Buffer.from('participant2-public-key')
    };

    // Create protocol instances
    protocol1 = new KeyExchangeProtocol();
    protocol2 = new KeyExchangeProtocol();

    // Set up message handlers
    protocol1.onMessage(async (message) => {
      messages.push(message);
      await protocol2.sendMessage(message);
    });

    protocol2.onMessage(async (message) => {
      messages.push(message);
      await protocol1.sendMessage(message);
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

    const session = await protocol1.createSession([participant1, participant2]);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(2);
    expect(session.startTime).toBeDefined();
  });

  it('should perform key exchange between two participants', async () => {
    // Initialize and start both protocols
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start()
    ]);

    // Create sessions
    const session1 = await protocol1.createSession([participant1, participant2]);
    const session2 = await protocol2.createSession([participant1, participant2]);

    // Join sessions
    await Promise.all([
      protocol2.joinSession(session1.id),
      protocol1.joinSession(session2.id)
    ]);

    // Wait for key exchange to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify shared secrets
    const secret1 = protocol1.getSharedSecret(participant2.id);
    const secret2 = protocol2.getSharedSecret(participant1.id);

    expect(secret1).toBeDefined();
    expect(secret2).toBeDefined();
    expect(secret1).toEqual(secret2);
  });

  it('should handle multiple participants', async () => {
    const protocol3 = new KeyExchangeProtocol();
    const participant3 = {
      id: 'participant3',
      publicKey: Buffer.from('participant3-public-key')
    };

    // Set up message handlers
    protocol3.onMessage(async (message) => {
      messages.push(message);
      await Promise.all([
        protocol1.sendMessage(message),
        protocol2.sendMessage(message)
      ]);
    });

    // Initialize and start all protocols
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

    // Create sessions
    const participants = [participant1, participant2, participant3];
    const session1 = await protocol1.createSession(participants);
    const session2 = await protocol2.createSession(participants);
    const session3 = await protocol3.createSession(participants);

    // Join sessions
    await Promise.all([
      protocol2.joinSession(session1.id),
      protocol3.joinSession(session1.id),
      protocol1.joinSession(session2.id),
      protocol3.joinSession(session2.id),
      protocol1.joinSession(session3.id),
      protocol2.joinSession(session3.id)
    ]);

    // Wait for key exchange to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify shared secrets
    const secret12 = protocol1.getSharedSecret(participant2.id);
    const secret21 = protocol2.getSharedSecret(participant1.id);
    const secret13 = protocol1.getSharedSecret(participant3.id);
    const secret31 = protocol3.getSharedSecret(participant1.id);
    const secret23 = protocol2.getSharedSecret(participant3.id);
    const secret32 = protocol3.getSharedSecret(participant2.id);

    expect(secret12).toEqual(secret21);
    expect(secret13).toEqual(secret31);
    expect(secret23).toEqual(secret32);
  });

  it('should handle session leave correctly', async () => {
    await protocol1.initialize();
    await protocol1.start();

    const session = await protocol1.createSession([participant1, participant2]);
    await protocol1.leaveSession(session.id);

    expect(protocol1['state'].currentSession).toBeUndefined();
    expect(protocol1['state'].activeSessions.size).toBe(0);
  });

  it('should handle errors correctly', async () => {
    await protocol1.initialize();
    await protocol1.start();

    // Try to get shared secret without session
    expect(() => {
      protocol1.getSharedSecret('non-existent');
    }).toThrow('No active session');

    // Try to send message without session
    await expect(protocol1.sendMessage({
      type: 'TEST',
      sender: 'test',
      receiver: 'test',
      content: Buffer.alloc(0),
      timestamp: new Date()
    })).rejects.toThrow('No active session');
  });

  it('should complete key exchange successfully', async () => {
    await protocol1.initialize();
    await protocol1.start();
    await protocol2.initialize();
    await protocol2.start();

    const session = await protocol1.createSession([participant1, participant2]);
    await protocol2.joinSession(session.id);

    // Wait for key exchange to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(protocol1.isComplete()).toBe(true);
    expect(protocol2.isComplete()).toBe(true);
  });
}); 