import { Buffer } from 'buffer';
import { CommitmentProtocol, CommitmentMessageType } from '../commitment';
import { Participant, Message } from '../types';

describe('Commitment Protocol', () => {
  let committerProtocol: CommitmentProtocol;
  let verifierProtocol: CommitmentProtocol;
  let participants: Participant[];
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants
    participants = [
      {
        id: 'committer',
        publicKey: Buffer.from('committer-public-key')
      },
      {
        id: 'verifier',
        publicKey: Buffer.from('verifier-public-key')
      }
    ];

    // Create protocol instances
    committerProtocol = new CommitmentProtocol();
    verifierProtocol = new CommitmentProtocol();

    // Set up message handlers
    committerProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[1].id) {
        await verifierProtocol.sendMessage(message);
      }
    });

    verifierProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[0].id) {
        await committerProtocol.sendMessage(message);
      }
    });
  });

  it('should initialize and start correctly', async () => {
    await committerProtocol.initialize();
    await committerProtocol.start();
    expect(committerProtocol['state'].isInitialized).toBe(true);
    expect(committerProtocol['state'].isRunning).toBe(true);
  });

  it('should create session with participants', async () => {
    await committerProtocol.initialize();
    await committerProtocol.start();

    const session = await committerProtocol.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(2);
    expect(session.startTime).toBeDefined();
  });

  it('should complete commitment protocol successfully', async () => {
    await Promise.all([
      committerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      committerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await committerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set value and generate commitment
    const value = Buffer.from('secret value');
    committerProtocol.setValue(value);
    await committerProtocol.commit();

    // Wait for commitment to be received
    await new Promise(resolve => setTimeout(resolve, 100));

    // Open commitment
    await committerProtocol.open();

    // Wait for verification
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify protocol completion and commitment verification
    expect(committerProtocol.isComplete()).toBe(true);
    expect(verifierProtocol.isVerified()).toBe(true);
  });

  it('should maintain hiding property', async () => {
    await Promise.all([
      committerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      committerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await committerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set value and generate commitment
    const value = Buffer.from('secret value');
    committerProtocol.setValue(value);
    await committerProtocol.commit();

    // Wait for commitment to be received
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that commitment message doesn't reveal value
    const commitMessage = messages.find(m => m.type === CommitmentMessageType.COMMIT);
    expect(commitMessage).toBeDefined();
    expect(commitMessage!.content.length).toBe(32); // Hash length
    expect(Buffer.compare(commitMessage!.content, value)).not.toBe(0);
  });

  it('should maintain binding property', async () => {
    await Promise.all([
      committerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      committerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await committerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set value and generate commitment
    const value1 = Buffer.from('value 1');
    committerProtocol.setValue(value1);
    await committerProtocol.commit();

    // Try to open with different value
    const value2 = Buffer.from('value 2');
    committerProtocol.setValue(value2);
    await committerProtocol.open();

    // Wait for verification
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that commitment fails verification
    expect(verifierProtocol.isVerified()).toBe(false);
  });

  it('should generate different commitments for same value', async () => {
    await Promise.all([
      committerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      committerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await committerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // First commitment
    const value = Buffer.from('test value');
    committerProtocol.setValue(value);
    await committerProtocol.commit();
    await new Promise(resolve => setTimeout(resolve, 100));
    const commitment1 = messages.find(m => m.type === CommitmentMessageType.COMMIT)?.content;

    // Clear messages array
    messages = [];

    // Second commitment
    committerProtocol.setValue(value);
    await committerProtocol.commit();
    await new Promise(resolve => setTimeout(resolve, 100));
    const commitment2 = messages.find(m => m.type === CommitmentMessageType.COMMIT)?.content;

    expect(commitment1).toBeDefined();
    expect(commitment2).toBeDefined();
    expect(Buffer.compare(commitment1!, commitment2!)).not.toBe(0);
  });

  it('should handle invalid states', async () => {
    await committerProtocol.initialize();
    await committerProtocol.start();

    // Try to commit without setting value
    await expect(committerProtocol.commit()).rejects.toThrow('Value not set');

    // Try to open without generating commitment
    await expect(committerProtocol.open()).rejects.toThrow('Commitment not generated');

    // Try to verify without active session
    await expect(verifierProtocol.verify()).rejects.toThrow('No active session');
  });

  it('should handle participant leaving during protocol', async () => {
    await Promise.all([
      committerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      committerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await committerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set value and generate commitment
    const value = Buffer.from('test value');
    committerProtocol.setValue(value);
    await committerProtocol.commit();

    // Verifier leaves before opening
    await verifierProtocol.leaveSession(session.id);

    // Open commitment
    await committerProtocol.open();

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that verifier didn't process the opening
    expect(verifierProtocol.isVerified()).toBe(false);
  });
}); 