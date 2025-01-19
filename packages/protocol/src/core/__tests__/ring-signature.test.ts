import { Buffer } from 'buffer';
import { RingSignatureProtocol, RingSignatureMessageType } from '../ring-signature';
import { Participant, Message } from '../types';

describe('Ring Signature Protocol', () => {
  let signerProtocol: RingSignatureProtocol;
  let verifierProtocol: RingSignatureProtocol;
  let participants: Participant[];
  let messages: Message[] = [];

  beforeEach(() => {
    // Reset message queue
    messages = [];

    // Create participants (ring members)
    participants = Array.from({ length: 5 }, (_, i) => ({
      id: `participant${i + 1}`,
      publicKey: Buffer.from(`participant${i + 1}-public-key`)
    }));

    // Create protocol instances
    signerProtocol = new RingSignatureProtocol();
    verifierProtocol = new RingSignatureProtocol();

    // Set up message handlers
    signerProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[1].id) {
        await verifierProtocol.sendMessage(message);
      }
    });

    verifierProtocol.onMessage(async (message) => {
      messages.push(message);
      if (message.receiver === '*' || message.receiver === participants[0].id) {
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

  it('should create session with ring members', async () => {
    await signerProtocol.initialize();
    await signerProtocol.start();

    const session = await signerProtocol.createSession(participants);
    expect(session.id).toBeDefined();
    expect(session.participants).toHaveLength(5);
    expect(session.startTime).toBeDefined();
  });

  it('should complete ring signature protocol successfully', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set message to be signed
    const message = Buffer.from('test message');
    signerProtocol.setMessage(message);
    verifierProtocol.setMessage(message);

    // Generate ring signature
    await signerProtocol.sign();

    // Wait for verification
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify protocol completion and signature verification
    expect(signerProtocol.isComplete()).toBe(true);
    expect(verifierProtocol.isVerified()).toBe(true);
  });

  it('should maintain signer anonymity', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set message and generate signature
    const message = Buffer.from('secret message');
    signerProtocol.setMessage(message);
    verifierProtocol.setMessage(message);
    await signerProtocol.sign();

    // Wait for verification
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify signature
    const signatureMessage = messages.find(m => m.type === RingSignatureMessageType.SIGNATURE);
    expect(signatureMessage).toBeDefined();
    
    // Check that signature doesn't reveal signer
    const signature = signatureMessage!.content;
    const keyImages = Array.from({ length: participants.length }, (_, i) => 
      signature.slice(i * 32, (i + 1) * 32)
    );

    // All key images should look random
    const allDifferent = keyImages.every((ki1, i) => 
      keyImages.every((ki2, j) => 
        i === j || !Buffer.compare(ki1, ki2)
      )
    );
    expect(allDifferent).toBe(true);
  });

  it('should generate different signatures for different messages', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // First message
    const message1 = Buffer.from('message 1');
    signerProtocol.setMessage(message1);
    verifierProtocol.setMessage(message1);
    await signerProtocol.sign();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature1 = messages.find(m => m.type === RingSignatureMessageType.SIGNATURE)?.content;

    // Clear messages array
    messages = [];

    // Second message
    const message2 = Buffer.from('message 2');
    signerProtocol.setMessage(message2);
    verifierProtocol.setMessage(message2);
    await signerProtocol.sign();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature2 = messages.find(m => m.type === RingSignatureMessageType.SIGNATURE)?.content;

    expect(signature1).toBeDefined();
    expect(signature2).toBeDefined();
    expect(Buffer.compare(signature1!, signature2!)).not.toBe(0);
  });

  it('should handle invalid states', async () => {
    await signerProtocol.initialize();
    await signerProtocol.start();

    // Try to sign without setting message
    await expect(signerProtocol.sign()).rejects.toThrow('Message not set');

    // Try to verify without active session
    const signature = Buffer.alloc(32);
    await expect(verifierProtocol.verify(signature)).rejects.toThrow('No active session');
  });

  it('should handle participant leaving during protocol', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      verifierProtocol.start()
    ]);

    const session = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session.id);

    // Set message and start signing
    const message = Buffer.from('test message');
    signerProtocol.setMessage(message);
    verifierProtocol.setMessage(message);

    // Verifier leaves before signature is generated
    await verifierProtocol.leaveSession(session.id);

    // Generate signature
    await signerProtocol.sign();

    // Wait for some time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that verifier didn't process the signature
    expect(verifierProtocol.isVerified()).toBe(false);
  });

  it('should handle multiple signing sessions', async () => {
    await Promise.all([
      signerProtocol.initialize(),
      verifierProtocol.initialize()
    ]);

    await Promise.all([
      signerProtocol.start(),
      verifierProtocol.start()
    ]);

    // First session
    const session1 = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session1.id);

    const message1 = Buffer.from('message 1');
    signerProtocol.setMessage(message1);
    verifierProtocol.setMessage(message1);
    await signerProtocol.sign();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature1 = messages.find(m => m.type === RingSignatureMessageType.SIGNATURE)?.content;

    // Second session
    const session2 = await signerProtocol.createSession(participants);
    await verifierProtocol.joinSession(session2.id);

    const message2 = Buffer.from('message 2');
    signerProtocol.setMessage(message2);
    verifierProtocol.setMessage(message2);
    await signerProtocol.sign();
    await new Promise(resolve => setTimeout(resolve, 100));
    const signature2 = messages.find(m => m.type === RingSignatureMessageType.SIGNATURE)?.content;

    expect(signature1).toBeDefined();
    expect(signature2).toBeDefined();
    expect(Buffer.compare(signature1!, signature2!)).not.toBe(0);
  });
}); 