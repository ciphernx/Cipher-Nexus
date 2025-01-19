import { Buffer } from 'buffer';
import { Curve25519, HKDF } from '@ciphernx/crypto';
import { BaseProtocol } from './base';
import { Message, Session, ProtocolErrorType } from './types';

/**
 * Key exchange message types
 */
enum KeyExchangeMessageType {
  PUBLIC_KEY = 'PUBLIC_KEY',
  FINISHED = 'FINISHED'
}

/**
 * Key exchange session state
 */
interface KeyExchangeState {
  localKeyPair?: {
    publicKey: Buffer;
    secretKey: Buffer;
  };
  remotePublicKeys: Map<string, Buffer>;
  sharedSecrets: Map<string, Buffer>;
  isComplete: boolean;
}

/**
 * Secure key exchange protocol implementation using Curve25519
 */
export class KeyExchangeProtocol extends BaseProtocol {
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
      remotePublicKeys: new Map(),
      sharedSecrets: new Map(),
      isComplete: false
    } as KeyExchangeState;

    // Generate local key pair
    const keyPair = Curve25519.generateKeyPair();
    (session.state as KeyExchangeState).localKeyPair = keyPair;

    // Broadcast public key to all participants
    await this.broadcastPublicKey(session);
  }

  protected async onJoinSession(session: Session): Promise<void> {
    // Initialize session state
    session.state = {
      remotePublicKeys: new Map(),
      sharedSecrets: new Map(),
      isComplete: false
    } as KeyExchangeState;

    // Generate local key pair
    const keyPair = Curve25519.generateKeyPair();
    (session.state as KeyExchangeState).localKeyPair = keyPair;

    // Broadcast public key to all participants
    await this.broadcastPublicKey(session);
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
      case KeyExchangeMessageType.PUBLIC_KEY:
        await this.handlePublicKeyMessage(session, message);
        break;
      case KeyExchangeMessageType.FINISHED:
        await this.handleFinishedMessage(session, message);
        break;
      default:
        throw this.createError(
          ProtocolErrorType.INVALID_MESSAGE,
          `Unknown message type: ${message.type}`
        );
    }
  }

  /**
   * Get the shared secret for a specific participant
   */
  public getSharedSecret(participantId: string): Buffer | undefined {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as KeyExchangeState;
    return state.sharedSecrets.get(participantId);
  }

  /**
   * Check if key exchange is complete
   */
  public isComplete(): boolean {
    const session = this.state.currentSession;
    if (!session) {
      return false;
    }

    const state = session.state as KeyExchangeState;
    return state.isComplete;
  }

  private async broadcastPublicKey(session: Session): Promise<void> {
    const state = session.state as KeyExchangeState;
    if (!state.localKeyPair) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Local key pair not generated');
    }

    // Create and broadcast public key message
    const message: Message = {
      type: KeyExchangeMessageType.PUBLIC_KEY,
      sender: session.participants[0].id, // Assuming first participant is local
      receiver: '*', // Broadcast to all
      content: state.localKeyPair.publicKey,
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  private async handlePublicKeyMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as KeyExchangeState;

    // Store remote public key
    state.remotePublicKeys.set(message.sender, message.content);

    // If we have all public keys, compute shared secrets
    if (state.remotePublicKeys.size === session.participants.length - 1) {
      await this.computeSharedSecrets(session);
      await this.sendFinished(session);
    }
  }

  private async handleFinishedMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as KeyExchangeState;
    
    // Mark key exchange as complete when all participants have finished
    let allFinished = true;
    for (const participant of session.participants) {
      if (participant.id !== session.participants[0].id && // Skip local participant
          !state.sharedSecrets.has(participant.id)) {
        allFinished = false;
        break;
      }
    }

    if (allFinished) {
      state.isComplete = true;
    }
  }

  private async computeSharedSecrets(session: Session): Promise<void> {
    const state = session.state as KeyExchangeState;
    if (!state.localKeyPair) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Local key pair not generated');
    }

    // Compute shared secret with each participant
    for (const [participantId, publicKey] of state.remotePublicKeys) {
      const sharedSecret = Curve25519.computeSharedSecret(
        state.localKeyPair.secretKey,
        publicKey
      );

      // Derive final key using HKDF
      const derivedKey = HKDF.derive(sharedSecret, 32, {
        salt: Buffer.from('KeyExchange'),
        info: Buffer.from(`${session.id}:${participantId}`)
      });

      state.sharedSecrets.set(participantId, derivedKey);
    }
  }

  private async sendFinished(session: Session): Promise<void> {
    const message: Message = {
      type: KeyExchangeMessageType.FINISHED,
      sender: session.participants[0].id, // Assuming first participant is local
      receiver: '*', // Broadcast to all
      content: Buffer.alloc(0), // Empty content
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }
} 