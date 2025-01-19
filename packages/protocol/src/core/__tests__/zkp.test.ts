import { Buffer } from 'buffer';
import { ZKPProtocol, ZKPMessageType } from '../zkp';
import { Participant, Message } from '../types';

describe('Zero-Knowledge Proof Protocol', () => {
  let proverProtocol: ZKPProtocol;
  let verifierProtocol: ZKPProtocol;
  let participants: Participant[];
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants
    participants = [
      {
        id: 'prover',
        publicKey: Buffer.from('prover-public-key')
      },
      {
        id: 'verifier',
        publicKey: Buffer.from('verifier-public-key')
      }
    ];

    // Create protocol instances
    proverProtocol = new ZKPProtocol();
    verifierProtocol = new ZKPProtocol();

    // Set up message handlers
    proverProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[1].id) {
        await verifierProtocol.sendMessage(message);
      }
    });

    verifierProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[0].id) {
        await proverProtocol.sendMessage(message);
      }
    });
  });

  it('should initialize and start correctly', async () => {
    await proverProtocol.initialize();
    await proverProtocol.start();
    expect(proverProtocol['state'].isInitialized).toBe(true);
    expect(proverProtocol['state'].isRunning).toBe(true);
  });

  it('should create session with participants', async () => {
    await proverProtocol.initialize();
    await proverProtocol.start();

    const session = await proverProtocol.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(2);
    expect(session.startTime).toBeDefined();
  });

  it('should complete zero-knowledge proof protocol successfully', async () => {
    await Promise.all([
      proverProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      proverProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set secret and generate proof
    const secret = Buffer.from('secret value');
    proverProtocol.setSecret(secret);
    await proverProtocol.prove();

    // Wait for protocol completion
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify protocol completion and proof verification
    expect(proverProtocol.isComplete()).toBe(true);
    expect(verifierProtocol.isVerified()).toBe(true);
  });

  it('should maintain zero-knowledge property', async () => {
    await Promise.all([
      proverProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      proverProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set secret and generate proof
    const secret = Buffer.from('secret value');
    proverProtocol.setSecret(secret);
    await proverProtocol.prove();

    // Wait for protocol completion
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that messages don't reveal secret
    const commitmentMessage = messages.find(m => m.type === ZKPMessageType.COMMITMENT);
    const challengeMessage = messages.find(m => m.type === ZKPMessageType.CHALLENGE);
    const responseMessage = messages.find(m => m.type === ZKPMessageType.RESPONSE);

    expect(commitmentMessage).toBeDefined();
    expect(challengeMessage).toBeDefined();
    expect(responseMessage).toBeDefined();

    // Verify that none of the messages contain the secret
    expect(Buffer.compare(commitmentMessage!.content, secret)).not.toBe(0);
    expect(Buffer.compare(challengeMessage!.content, secret)).not.toBe(0);
    expect(Buffer.compare(responseMessage!.content, secret)).not.toBe(0);
  });

  it('should generate different proofs for same secret', async () => {
    await Promise.all([
      proverProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      proverProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // First proof
    const secret = Buffer.from('test secret');
    proverProtocol.setSecret(secret);
    await proverProtocol.prove();
    await new Promise(resolve => setTimeout(resolve, 100));
    const commitment1 = messages.find(m => m.type === ZKPMessageType.COMMITMENT)?.content;
    const response1 = messages.find(m => m.type === ZKPMessageType.RESPONSE)?.content;

    // Clear messages array
    messages = [];

    // Second proof
    proverProtocol.setSecret(secret);
    await proverProtocol.prove();
    await new Promise(resolve => setTimeout(resolve, 100));
    const commitment2 = messages.find(m => m.type === ZKPMessageType.COMMITMENT)?.content;
    const response2 = messages.find(m => m.type === ZKPMessageType.RESPONSE)?.content;

    expect(commitment1).toBeDefined();
    expect(commitment2).toBeDefined();
    expect(response1).toBeDefined();
    expect(response2).toBeDefined();
    expect(Buffer.compare(commitment1!, commitment2!)).not.toBe(0);
    expect(Buffer.compare(response1!, response2!)).not.toBe(0);
  });

  it('should handle invalid states', async () => {
    await proverProtocol.initialize();
    await proverProtocol.start();

    // Try to prove without setting secret
    await expect(proverProtocol.prove()).rejects.toThrow('Secret not set');

    // Try to verify without active session
    await expect(verifierProtocol.verify()).rejects.toThrow('No active session');

    // Try to respond without challenge
    await expect(proverProtocol.respond()).rejects.toThrow('Missing required state');
  });

  it('should handle participant leaving during protocol', async () => {
    await Promise.all([
      proverProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      proverProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set secret and start proof
    const secret = Buffer.from('test secret');
    proverProtocol.setSecret(secret);
    await proverProtocol.prove();

    // Verifier leaves before sending challenge
    await verifierProtocol.leaveSession(session.id);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that protocol is not complete
    expect(proverProtocol.isComplete()).toBe(false);
    expect(verifierProtocol.isVerified()).toBe(false);
  });

  it('should handle concurrent proofs in different sessions', async () => {
    await Promise.all([
      proverProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      proverProtocol.start(),
      verifierProtocol.start()
    ]);

    // First session
    const session1 = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session1.id);

    const secret1 = Buffer.from('secret 1');
    proverProtocol.setSecret(secret1);
    await proverProtocol.prove();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second session
    const session2 = await proverProtocol.createSession(participants);
    await verifierProtocol.joinSession(session2.id);

    const secret2 = Buffer.from('secret 2');
    proverProtocol.setSecret(secret2);
    await proverProtocol.prove();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify both proofs completed successfully
    expect(proverProtocol.isComplete()).toBe(true);
    expect(verifierProtocol.isVerified()).toBe(true);
  });
}); 