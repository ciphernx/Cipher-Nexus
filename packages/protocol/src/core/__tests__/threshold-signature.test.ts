import { Buffer } from 'buffer';
import { ThresholdSignatureProtocol, ThresholdSignatureMessageType } from '../threshold-signature';
import { Participant, Message } from '../types';

describe('Threshold Signature Protocol', () => {
  let protocol1: ThresholdSignatureProtocol;
  let protocol2: ThresholdSignatureProtocol;
  let protocol3: ThresholdSignatureProtocol;
  let participant1: Participant;
  let participant2: Participant;
  let participant3: Participant;
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

    participant3 = {
      id: 'participant3',
      publicKey: Buffer.from('participant3-public-key')
    };

    // Create protocol instances
    protocol1 = new ThresholdSignatureProtocol();
    protocol2 = new ThresholdSignatureProtocol();
    protocol3 = new ThresholdSignatureProtocol();

    // Set up message handlers
    protocol1.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participant2.id) {
        await protocol2.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participant3.id) {
        await protocol3.sendMessage(message);
      }
    });

    protocol2.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participant1.id) {
        await protocol1.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participant3.id) {
        await protocol3.sendMessage(message);
      }
    });

    protocol3.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participant1.id) {
        await protocol1.sendMessage(message);
      }
      if (message.receiver === '*' || message.receiver === participant2.id) {
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

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(3);
    expect(session.startTime).toBeDefined();
  });

  it('should generate and distribute key shares', async () => {
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

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);
    await protocol2.joinSession(session.id);
    await protocol3.joinSession(session.id);

    await protocol1.generateKeyShares();

    // Wait for share distribution
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that all participants received their shares
    const state1 = protocol1['state'].currentSession!.state;
    const state2 = protocol2['state'].currentSession!.state;
    const state3 = protocol3['state'].currentSession!.state;

    expect(state1.privateKeyShare).toBeDefined();
    expect(state2.privateKeyShare).toBeDefined();
    expect(state3.privateKeyShare).toBeDefined();
  });

  it('should sign message with threshold signatures', async () => {
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

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);
    await protocol2.joinSession(session.id);
    await protocol3.joinSession(session.id);

    // Generate key shares
    await protocol1.generateKeyShares();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Sign message
    const message = Buffer.from('test message');
    await protocol1.signMessage(message);
    await protocol2.signMessage(message);
    await protocol3.signMessage(message);

    // Wait for signature generation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify signatures
    const signature1 = protocol1.getSignature();
    const signature2 = protocol2.getSignature();
    const signature3 = protocol3.getSignature();

    expect(signature1).toBeDefined();
    expect(signature2).toBeDefined();
    expect(signature3).toBeDefined();
    expect(signature1).toEqual(signature2);
    expect(signature2).toEqual(signature3);
  });

  it('should handle invalid threshold values', async () => {
    await protocol1.initialize();
    await protocol1.start();

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);

    expect(() => {
      protocol1.setThreshold(0);
    }).toThrow('Invalid threshold value');

    expect(() => {
      protocol1.setThreshold(4);
    }).toThrow('Invalid threshold value');
  });

  it('should require minimum threshold of signatures', async () => {
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

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);
    await protocol2.joinSession(session.id);
    await protocol3.joinSession(session.id);

    // Set threshold to 3
    protocol1.setThreshold(3);

    // Generate key shares
    await protocol1.generateKeyShares();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Sign message with only 2 participants
    const message = Buffer.from('test message');
    await protocol1.signMessage(message);
    await protocol2.signMessage(message);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that signature is not complete
    expect(protocol1.isComplete()).toBe(false);
    expect(protocol1.getSignature()).toBeUndefined();
  });

  it('should handle participant leaving during signing', async () => {
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

    const participants = [participant1, participant2, participant3];
    const session = await protocol1.createSession(participants);
    await protocol2.joinSession(session.id);
    await protocol3.joinSession(session.id);

    // Generate key shares
    await protocol1.generateKeyShares();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start signing
    const message = Buffer.from('test message');
    await protocol1.signMessage(message);
    
    // Participant 2 leaves
    await protocol2.leaveSession(session.id);
    
    // Participant 3 signs
    await protocol3.signMessage(message);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that signature generation still completes with remaining participants
    expect(protocol1.isComplete()).toBe(true);
    expect(protocol1.getSignature()).toBeDefined();
  });

  it('should handle multiple signing sessions', async () => {
    await Promise.all([
      protocol1.initialize(),
      protocol2.initialize()
    ]);

    await Promise.all([
      protocol1.start(),
      protocol2.start()
    ]);

    const participants = [participant1, participant2];
    const session = await protocol1.createSession(participants);
    await protocol2.joinSession(session.id);

    // First signing session
    await protocol1.generateKeyShares();
    await new Promise(resolve => setTimeout(resolve, 100));

    const message1 = Buffer.from('message 1');
    await protocol1.signMessage(message1);
    await protocol2.signMessage(message1);
    await new Promise(resolve => setTimeout(resolve, 100));

    const signature1 = protocol1.getSignature();
    expect(signature1).toBeDefined();

    // Second signing session
    const message2 = Buffer.from('message 2');
    await protocol1.signMessage(message2);
    await protocol2.signMessage(message2);
    await new Promise(resolve => setTimeout(resolve, 100));

    const signature2 = protocol1.getSignature();
    expect(signature2).toBeDefined();
    expect(signature2).not.toEqual(signature1);
  });
}); 