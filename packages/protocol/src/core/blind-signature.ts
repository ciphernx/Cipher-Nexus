import { Buffer } from 'buffer';
import { BaseProtocol } from './base';
import { Message, Session, ProtocolErrorType } from './types';
import { ProtocolValidator } from '../utils/validator';

/**
 * Blind signature message types
 */
export enum BlindSignatureMessageType {
  BLINDED = 'BLINDED',
  SIGNATURE = 'SIGNATURE',
  UNBLINDED = 'UNBLINDED'
}

/**
 * Blind signature session state
 */
interface BlindSignatureState {
  // Signer state
  signerPrivateKey?: Buffer;
  signerPublicKey?: Buffer;

  // User state
  message?: Buffer;
  blindingFactor?: Buffer;
  blindedMessage?: Buffer;
  blindSignature?: Buffer;
  signature?: Buffer;

  // Protocol state
  isComplete: boolean;
}

/**
 * Blind Signature Protocol
 * Implements blind signature scheme where signer cannot see the message content
 */
export class BlindSignatureProtocol extends BaseProtocol {
  protected async onInitialize(): Promise<void> {
    // No specific initialization needed
  }

  protected async onStart(): Promise<void> {
    // No specific start actions needed
  }

  protected async onStop(): Promise<void> {
    // Clean up any resources
    if (this.state.currentSession) {
      await this.leaveSession(this.state.currentSession.id);
    }
  }

  protected async onCreateSession(session: Session): Promise<void> {
    // Initialize session state
    session.state = {
      isComplete: false
    } as BlindSignatureState;

    // If creator is signer, generate key pair
    if (session.participants[0].id === this.state.localParticipant?.id) {
      const keyPair = this.generateKeyPair();
      (session.state as BlindSignatureState).signerPrivateKey = keyPair.privateKey;
      (session.state as BlindSignatureState).signerPublicKey = keyPair.publicKey;
    }
  }

  protected async onJoinSession(session: Session): Promise<void> {
    // Initialize session state
    session.state = {
      isComplete: false
    } as BlindSignatureState;
  }

  protected async onLeaveSession(session: Session): Promise<void> {
    // Clean up session state
    session.state = {};
    session.endTime = new Date();
  }

  protected async onSendMessage(message: Message): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    // Process message based on type
    switch (message.type) {
      case BlindSignatureMessageType.BLINDED:
        await this.handleBlindedMessage(session, message);
        break;
      case BlindSignatureMessageType.SIGNATURE:
        await this.handleSignatureMessage(session, message);
        break;
      case BlindSignatureMessageType.UNBLINDED:
        await this.handleUnblindedMessage(session, message);
        break;
      default:
        throw this.createError(
          ProtocolErrorType.INVALID_MESSAGE,
          `Unknown message type: ${message.type}`
        );
    }
  }

  /**
   * Set message to be signed (User)
   */
  public setMessage(message: Buffer): void {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as BlindSignatureState;
    state.message = message;
  }

  /**
   * Blind message and send to signer (User)
   */
  public async blindMessage(): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as BlindSignatureState;
    if (!state.message) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Message not set');
    }

    // Generate blinding factor and blind message
    state.blindingFactor = this.generateBlindingFactor();
    state.blindedMessage = this.blind(state.message, state.blindingFactor);

    // Send blinded message to signer
    const message: Message = {
      type: BlindSignatureMessageType.BLINDED,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[0].id, // Signer is always first participant
      content: state.blindedMessage,
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  /**
   * Sign blinded message (Signer)
   */
  public async signBlindedMessage(blindedMessage: Buffer): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as BlindSignatureState;
    if (!state.signerPrivateKey) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Signer private key not set');
    }

    // Sign blinded message
    const blindSignature = this.sign(blindedMessage, state.signerPrivateKey);

    // Send blind signature to user
    const message: Message = {
      type: BlindSignatureMessageType.SIGNATURE,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[1].id, // User is always second participant
      content: blindSignature,
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  /**
   * Unblind signature (User)
   */
  public async unblindSignature(blindSignature: Buffer): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as BlindSignatureState;
    if (!state.blindingFactor) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Blinding factor not set');
    }

    // Unblind signature
    state.signature = this.unblind(blindSignature, state.blindingFactor);
    state.isComplete = true;

    // Notify completion
    const message: Message = {
      type: BlindSignatureMessageType.UNBLINDED,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[0].id,
      content: Buffer.from('COMPLETE'),
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  /**
   * Get signature (User)
   */
  public getSignature(): Buffer | undefined {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    return (session.state as BlindSignatureState).signature;
  }

  /**
   * Check if protocol is complete
   */
  public isComplete(): boolean {
    const session = this.state.currentSession;
    if (!session) {
      return false;
    }

    return (session.state as BlindSignatureState).isComplete;
  }

  private async handleBlindedMessage(session: Session, message: Message): Promise<void> {
    // Handle blinded message as signer
    await this.signBlindedMessage(message.content);
  }

  private async handleSignatureMessage(session: Session, message: Message): Promise<void> {
    // Handle blind signature as user
    await this.unblindSignature(message.content);
  }

  private async handleUnblindedMessage(session: Session, message: Message): Promise<void> {
    // Mark protocol as complete for signer
    const state = session.state as BlindSignatureState;
    state.isComplete = true;
  }

  private generateKeyPair(): { privateKey: Buffer; publicKey: Buffer } {
    // Generate key pair (in practice, use proper RSA key generation)
    const privateKey = Buffer.from(new Uint8Array(32).map(() => Math.floor(Math.random() * 256)));
    const publicKey = Buffer.from(privateKey.map(byte => (byte * 7) % 256));
    return { privateKey, publicKey };
  }

  private generateBlindingFactor(): Buffer {
    // Generate random blinding factor
    return Buffer.from(new Uint8Array(32).map(() => Math.floor(Math.random() * 256)));
  }

  private blind(message: Buffer, blindingFactor: Buffer): Buffer {
    // Blind message (in practice, use proper RSA blinding)
    const blindedMessage = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      blindedMessage[i] = (message[i % message.length] * blindingFactor[i]) % 256;
    }
    return blindedMessage;
  }

  private sign(blindedMessage: Buffer, privateKey: Buffer): Buffer {
    // Sign blinded message (in practice, use proper RSA signing)
    const signature = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      signature[i] = (blindedMessage[i] * privateKey[i]) % 256;
    }
    return signature;
  }

  private unblind(blindSignature: Buffer, blindingFactor: Buffer): Buffer {
    // Unblind signature (in practice, use proper RSA unblinding)
    const signature = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      signature[i] = (blindSignature[i] * this.modInverse(blindingFactor[i], 256)) % 256;
    }
    return signature;
  }

  private modInverse(a: number, m: number): number {
    // Calculate modular multiplicative inverse
    a = ((a % m) + m) % m;
    for (let x = 1; x < m; x++) {
      if ((a * x) % m === 1) {
        return x;
      }
    }
    return 1;
  }
} 