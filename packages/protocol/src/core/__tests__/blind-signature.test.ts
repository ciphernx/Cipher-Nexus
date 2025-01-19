import { Buffer } from 'buffer';
import { BlindSignatureProtocol, BlindSignatureMessageType } from '../blind-signature';
import { Participant, Message } from '../types';

describe('Blind Signature Protocol', () => {
  let signerProtocol: BlindSignatureProtocol;
  let userProtocol: BlindSignatureProtocol;
  let signer: Participant;
  let user: Participant;
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants
    signer = {
      id: 'signer',
      publicKey: Buffer.from('signer-public-key')
    };

    user = {
      id: 'user',
      publicKey: Buffer.from('user-public-key')
    };

    // Create protocol instances
    signerProtocol = new BlindSignatureProtocol();
    userProtocol = new BlindSignatureProtocol();

    // Set up message handlers
    signerProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === user.id) {
        await userProtocol.sendMessage(message);
      }
    });

    userProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === signer.id) {
        await signerProtocol.sendMessage(message);
      }
    });
  });

  it('should initialize and start correctly', async () => {
    await signerProtocol.initialize();
    await signerProtocol.start();
    expect(signerProtocol['state'].isInitialized).toBe(true);
    expect(signerProtocol['state'].isRunning).toBe(true);
  });

  it('should create session with participants', async () => {
    await signerProtocol.initialize();
    await signerProtocol.start();

    const participants = [signer, user];
    const session = await signerProtocol.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(2);
    expect(session.startTime).toBeDefined();
  });

  it('should complete blind signature protocol successfully', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      userProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      userProtocol.start()
    ]);

    const participants = [signer, user];
    const session = await signerProtocol.createSession(participants);
    await userProtocol.joinSession(session.id);

    // Set message to be signed
    const message = Buffer.from('test message');
    userProtocol.setMessage(message);

    // Blind message and send to signer
    await userProtocol.blindMessage();

    // Wait for protocol completion
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify signature
    expect(userProtocol.isComplete()).toBe(true);
    expect(userProtocol.getSignature()).toBeDefined();
  });

  it('should maintain message privacy', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      userProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      userProtocol.start()
    ]);

    const participants = [signer, user];
    const session = await signerProtocol.createSession(participants);
    await userProtocol.joinSession(session.id);

    // Set message to be signed
    const message = Buffer.from('secret message');
    userProtocol.setMessage(message);

    // Blind message and send to signer
    await userProtocol.blindMessage();

    // Verify that blinded message is different from original
    const blindedMessage = messages.find(m => m.type === BlindSignatureMessageType.BLINDED)?.content;
    expect(blindedMessage).toBeDefined();
    expect(blindedMessage).not.toEqual(message);
  });

  it('should generate different signatures for different messages', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      userProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      userProtocol.start()
    ]);

    const participants = [signer, user];
    const session = await signerProtocol.createSession(participants);
    await userProtocol.joinSession(session.id);

    // First message
    const message1 = Buffer.from('message 1');
    userProtocol.setMessage(message1);
    await userProtocol.blindMessage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature1 = userProtocol.getSignature();

    // Second message
    const message2 = Buffer.from('message 2');
    userProtocol.setMessage(message2);
    await userProtocol.blindMessage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature2 = userProtocol.getSignature();

    expect(signature1).not.toEqual(signature2);
  });

  it('should handle invalid states', async () => {
    await userProtocol.initialize();
    await userProtocol.start();

    // Try to blind message without setting it
    await expect(userProtocol.blindMessage()).rejects.toThrow('Message not set');

    // Try to get signature without active session
    expect(() => userProtocol.getSignature()).toThrow('No active session');
  });

  it('should handle participant leaving during protocol', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      userProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      userProtocol.start()
    ]);

    const participants = [signer, user];
    const session = await signerProtocol.createSession(participants);
    await userProtocol.joinSession(session.id);

    // Set message and start protocol
    const message = Buffer.from('test message');
    userProtocol.setMessage(message);
    await userProtocol.blindMessage();

    // Signer leaves session
    await signerProtocol.leaveSession(session.id);

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify protocol did not complete
    expect(userProtocol.isComplete()).toBe(false);
    expect(userProtocol.getSignature()).toBeUndefined();
  });

  it('should handle multiple signing sessions', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      userProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      userProtocol.start()
    ]);

    // First session
    const participants1 = [signer, user];
    const session1 = await signerProtocol.createSession(participants1);
    await userProtocol.joinSession(session1.id);

    const message1 = Buffer.from('message 1');
    userProtocol.setMessage(message1);
    await userProtocol.blindMessage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature1 = userProtocol.getSignature();

    // Second session
    const session2 = await signerProtocol.createSession(participants1);
    await userProtocol.joinSession(session2.id);

    const message2 = Buffer.from('message 2');
    userProtocol.setMessage(message2);
    await userProtocol.blindMessage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature2 = userProtocol.getSignature();

    expect(signature1).toBeDefined();
    expect(signature2).toBeDefined();
    expect(signature1).not.toEqual(signature2);
  });
}); 