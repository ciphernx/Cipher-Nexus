import { Buffer } from 'buffer';
import { BaseProtocol } from './base';
import { Message, Session, ProtocolErrorType } from './types';
import { ProtocolValidator } from '../utils/validator';

/**
 * Commitment message types
 */
export enum CommitmentMessageType {
  COMMIT = 'COMMIT',
  OPEN = 'OPEN',
  VERIFY = 'VERIFY'
}

/**
 * Commitment session state
 */
interface CommitmentState {
  // Committer state
  value?: Buffer;
  randomness?: Buffer;
  commitment?: Buffer;

  // Verifier state
  receivedCommitment?: Buffer;
  receivedValue?: Buffer;
  receivedRandomness?: Buffer;

  // Protocol state
  isComplete: boolean;
  isVerified: boolean;
}

/**
 * Commitment Protocol
 * Implements commitment scheme where committer can commit to a value without revealing it
 */
export class CommitmentProtocol extends BaseProtocol {
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
      isComplete: false,
      isVerified: false
    } as CommitmentState;
  }

  protected async onJoinSession(session: Session): Promise<void> {
    // Initialize session state
    session.state = {
      isComplete: false,
      isVerified: false
    } as CommitmentState;
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
      case CommitmentMessageType.COMMIT:
        await this.handleCommitMessage(session, message);
        break;
      case CommitmentMessageType.OPEN:
        await this.handleOpenMessage(session, message);
        break;
      case CommitmentMessageType.VERIFY:
        await this.handleVerifyMessage(session, message);
        break;
      default:
        throw this.createError(
          ProtocolErrorType.INVALID_MESSAGE,
          `Unknown message type: ${message.type}`
        );
    }
  }

  /**
   * Set value to commit to (Committer)
   */
  public setValue(value: Buffer): void {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as CommitmentState;
    state.value = value;
  }

  /**
   * Generate and send commitment (Committer)
   */
  public async commit(): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as CommitmentState;
    if (!state.value) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Value not set');
    }

    // Generate randomness and commitment
    state.randomness = this.generateRandomness();
    state.commitment = this.generateCommitment(state.value, state.randomness);

    // Send commitment to verifier
    const message: Message = {
      type: CommitmentMessageType.COMMIT,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[1].id, // Verifier is always second participant
      content: state.commitment,
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  /**
   * Open commitment (Committer)
   */
  public async open(): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as CommitmentState;
    if (!state.value || !state.randomness) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Commitment not generated');
    }

    // Send opening information to verifier
    const message: Message = {
      type: CommitmentMessageType.OPEN,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[1].id,
      content: Buffer.concat([state.value, state.randomness]),
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
    state.isComplete = true;
  }

  /**
   * Verify opened commitment (Verifier)
   */
  public async verify(): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as CommitmentState;
    if (!state.receivedCommitment || !state.receivedValue || !state.receivedRandomness) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Opening information not received');
    }

    // Verify commitment
    const commitment = this.generateCommitment(state.receivedValue, state.receivedRandomness);
    const isValid = this.compareBuffers(commitment, state.receivedCommitment);

    state.isVerified = isValid;

    // Send verification result
    const message: Message = {
      type: CommitmentMessageType.VERIFY,
      sender: this.state.localParticipant!.id,
      receiver: session.participants[0].id,
      content: Buffer.from(isValid ? '1' : '0'),
      timestamp: new Date()
    };

    await this.notifyMessageHandlers(message);
  }

  /**
   * Check if commitment is verified
   */
  public isVerified(): boolean {
    const session = this.state.currentSession;
    if (!session) {
      return false;
    }

    return (session.state as CommitmentState).isVerified;
  }

  /**
   * Check if protocol is complete
   */
  public isComplete(): boolean {
    const session = this.state.currentSession;
    if (!session) {
      return false;
    }

    return (session.state as CommitmentState).isComplete;
  }

  private async handleCommitMessage(session: Session, message: Message): Promise<void> {
    // Store received commitment
    const state = session.state as CommitmentState;
    state.receivedCommitment = message.content;
  }

  private async handleOpenMessage(session: Session, message: Message): Promise<void> {
    // Extract value and randomness from opening
    const state = session.state as CommitmentState;
    state.receivedValue = message.content.slice(0, message.content.length / 2);
    state.receivedRandomness = message.content.slice(message.content.length / 2);

    // Verify commitment
    await this.verify();
  }

  private async handleVerifyMessage(session: Session, message: Message): Promise<void> {
    // Update verification status
    const state = session.state as CommitmentState;
    state.isVerified = message.content[0] === 1;
  }

  private generateRandomness(): Buffer {
    // Generate random value
    return Buffer.from(new Uint8Array(32).map(() => Math.floor(Math.random() * 256)));
  }

  private generateCommitment(value: Buffer, randomness: Buffer): Buffer {
    // Simple commitment scheme: commitment = hash(value || randomness)
    return this.hash(Buffer.concat([value, randomness]));
  }

  private hash(data: Buffer): Buffer {
    // Simple hash function (in practice, use cryptographic hash)
    const hash = Buffer.alloc(32);
    for (let i = 0; i < data.length; i++) {
      hash[i % 32] = (hash[i % 32] + data[i]) % 256;
    }
    return hash;
  }

  private compareBuffers(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
} 