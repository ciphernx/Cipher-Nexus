/// <reference types="node" />
import { Buffer } from 'buffer';
import { BaseProtocol } from './base';
import { Message, Session, ProtocolErrorType, ProtocolState } from './types';
import { createECDH, createHash } from 'crypto';

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
interface KeyExchangeState extends ProtocolState {
  localKeyPair?: {
    publicKey: Buffer;
    secretKey: Buffer;
  };
  remotePublicKeys: Map<string, Buffer>;
  sharedSecrets: Map<string, Buffer>;
  isComplete: boolean;
}

/**
 * Implements the key exchange protocol using ECDH
 */
export class KeyExchangeProtocol extends BaseProtocol {
  protected state: KeyExchangeState = {
    isInitialized: false,
    isRunning: false,
    activeSessions: new Map(),
    messageHandlers: new Set(),
    errorHandlers: new Set(),
    remotePublicKeys: new Map(),
    sharedSecrets: new Map(),
    isComplete: false
  };

  protected async onInitialize(): Promise<void> {
    // Generate local key pair
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    
    this.state.localKeyPair = {
      publicKey: ecdh.getPublicKey(),
      secretKey: ecdh.getPrivateKey()
    };
  }

  protected async onStart(): Promise<void> {
    // Reset state
    this.state.remotePublicKeys.clear();
    this.state.sharedSecrets.clear();
    this.state.isComplete = false;
  }

  protected async onStop(): Promise<void> {
    // Clean up state
    this.state.remotePublicKeys.clear();
    this.state.sharedSecrets.clear();
    this.state.isComplete = false;
  }

  protected async onCreateSession(session: Session): Promise<void> {
    if (!this.state.localKeyPair) {
      throw new Error('Protocol not initialized');
    }

    // Broadcast public key to all participants
    await this.broadcastPublicKey(session);
  }

  protected async onJoinSession(session: Session): Promise<void> {
    if (!this.state.localKeyPair) {
      throw new Error('Protocol not initialized');
    }

    // Broadcast public key to all participants
    await this.broadcastPublicKey(session);
  }

  protected async onLeaveSession(session: Session): Promise<void> {
    // Clean up session state
    this.state.remotePublicKeys.clear();
    this.state.sharedSecrets.clear();
    this.state.isComplete = false;
  }

  protected async onSendMessage(message: Message): Promise<void> {
    switch (message.type) {
      case KeyExchangeMessageType.PUBLIC_KEY:
        await this.handlePublicKeyMessage(message.session, message);
        break;
      case KeyExchangeMessageType.FINISHED:
        await this.handleFinishedMessage(message.session, message);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  public getSharedSecret(participantId: string): Buffer | undefined {
    return this.state.sharedSecrets.get(participantId);
  }

  public isComplete(): boolean {
    return this.state.isComplete;
  }

  private async broadcastPublicKey(session: Session): Promise<void> {
    if (!this.state.localKeyPair) {
      throw new Error('Protocol not initialized');
    }

    await this.broadcast(session, {
      type: KeyExchangeMessageType.PUBLIC_KEY,
      data: this.state.localKeyPair.publicKey
    });
  }

  private async handlePublicKeyMessage(session: Session, message: Message): Promise<void> {
    if (!message.data || !message.senderId) {
      throw new Error('Invalid public key message');
    }

    // Store remote public key
    this.state.remotePublicKeys.set(message.senderId, message.data);

    // If we have all public keys, compute shared secrets
    if (this.state.remotePublicKeys.size === session.participants.length - 1) {
      await this.computeSharedSecrets(session);
      await this.sendFinished(session);
    }
  }

  private async handleFinishedMessage(session: Session, message: Message): Promise<void> {
    if (!message.senderId) {
      throw new Error('Invalid finished message');
    }

    // If we have received finished messages from all participants, mark as complete
    const finishedCount = Array.from(session.participants).filter(
      p => p !== session.localParticipantId
    ).length;

    if (finishedCount === session.participants.length - 1) {
      this.state.isComplete = true;
    }
  }

  private async computeSharedSecrets(session: Session): Promise<void> {
    if (!this.state.localKeyPair) {
      throw new Error('Protocol not initialized');
    }

    // Compute shared secrets with each participant
    for (const [participantId, publicKey] of this.state.remotePublicKeys) {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(this.state.localKeyPair.secretKey);
      
      const sharedSecret = ecdh.computeSecret(publicKey);
      
      // Derive final key using HKDF
      const hash = createHash('sha256');
      hash.update(sharedSecret);
      
      this.state.sharedSecrets.set(participantId, hash.digest());
    }
  }

  private async sendFinished(session: Session): Promise<void> {
    await this.broadcast(session, {
      type: KeyExchangeMessageType.FINISHED
    });
  }
} 