import { Buffer } from 'buffer';
import { BaseProtocol } from './base';
import { Message, Session, ProtocolErrorType, ProtocolState } from './types';
import { ProtocolValidator } from '../utils/validator';
import { createHash, randomBytes } from 'crypto';
import { Logger } from '../utils/logger';

/**
 * MPC message types
 */
export enum MPCMessageType {
  SET_VALUE = 'SET_VALUE',
  SHARE = 'SHARE',
  RESULT = 'RESULT',
  RECOVERY = 'RECOVERY',
  VERIFY = 'VERIFY',           // New message type for verification
  COMMITMENT = 'COMMITMENT'    // New message type for commitments
}

/**
 * MPC computation types
 */
export enum MPCComputationType {
  SUM = 'SUM',
  AVERAGE = 'AVERAGE',
  MAX = 'MAX',
  MIN = 'MIN',
  MEDIAN = 'MEDIAN',
  VARIANCE = 'VARIANCE',
  MODE = 'MODE',           // New: mode
  STD_DEV = 'STD_DEV',    // New: standard deviation
  QUARTILE = 'QUARTILE',  // New: quartile
  RANGE = 'RANGE'         // New: range
}

/**
 * Message batch for optimized processing
 */
interface MessageBatch {
  messages: Message[];
  timestamp: Date;
}

/**
 * Audit log entry
 */
interface AuditLog {
  timestamp: Date;
  event: string;
  participantId: string;
  sessionId: string;
  details: any;
}

/**
 * MPC session state with enhanced security and batch processing
 */
interface MPCState {
  // Local state
  localValue?: Buffer;
  shares: Map<string, Buffer>;
  backupShares: Map<string, Buffer>;
  
  // Computation state
  computationType?: MPCComputationType;
  result?: Buffer;
  intermediateResults: Map<string, Buffer>;
  
  // Protocol state
  isComplete: boolean;
  recoveryMode: boolean;
  
  // Enhanced security features
  verificationShares: Map<string, Buffer>;
  commitments: Map<string, Buffer>;
  checksums: Map<string, Buffer>;
  thresholdScheme: {
    t: number;
    n: number;
    coefficients: Buffer[];
    verificationPoints: Buffer[];
  };
  
  // Batch processing
  pendingMessages: Message[];
  batchSize: number;
  batchTimeout: number;
  lastBatchTime: Date;
  processingBatch: boolean;
  
  // Privacy protection
  nonce: Buffer;
  blindingFactors: Map<string, Buffer>;
  
  // Audit logging
  auditLogs: AuditLog[];
}

/**
 * Secure Multi-Party Computation Protocol
 * Implements MPC operations with enhanced security and recovery features
 */
export class MPCProtocol extends BaseProtocol {
  private messageQueue: Message[] = [];
  private batchProcessingInterval: NodeJS.Timeout | null = null;
  private logger: Logger;
  
  constructor() {
    super();
    this.logger = new Logger('MPCProtocol');
  }

  protected async onInitialize(): Promise<void> {
    // Start batch processing
    this.startBatchProcessing();
  }

  protected async onStart(): Promise<void> {
    // No specific start actions needed
  }

  protected async onStop(): Promise<void> {
    // Stop batch processing
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
      this.batchProcessingInterval = null;
    }

    if (this.state.currentSession) {
      await this.leaveSession(this.state.currentSession.id);
    }
  }

  protected async onCreateSession(session: Session): Promise<void> {
    // Initialize session state with enhanced security features
    session.state = {
      shares: new Map<string, Buffer>(),
      backupShares: new Map<string, Buffer>(),
      intermediateResults: new Map<string, Buffer>(),
      isComplete: false,
      recoveryMode: false,
      verificationShares: new Map<string, Buffer>(),
      commitments: new Map<string, Buffer>(),
      checksums: new Map<string, Buffer>(),
      thresholdScheme: {
        t: 0,
        n: 0,
        coefficients: [],
        verificationPoints: []
      },
      
      // Initialize batch processing state
      pendingMessages: [],
      batchSize: 10, // Default batch size
      batchTimeout: 50, // Default timeout in ms
      lastBatchTime: new Date(),
      processingBatch: false,
      
      // Initialize privacy protection
      nonce: randomBytes(32),
      blindingFactors: new Map<string, Buffer>(),
      
      // Initialize audit logs
      auditLogs: []
    } as MPCState;
    
    this.logAudit(session, 'SESSION_CREATED', {
      participantCount: session.participants.length
    });
  }

  protected async onJoinSession(session: Session): Promise<void> {
    // Initialize session state
    session.state = {
      shares: new Map<string, Buffer>(),
      backupShares: new Map<string, Buffer>(),
      intermediateResults: new Map<string, Buffer>(),
      isComplete: false,
      recoveryMode: false,
      verificationShares: new Map<string, Buffer>(),
      commitments: new Map<string, Buffer>(),
      checksums: new Map<string, Buffer>(),
      thresholdScheme: {
        t: 0,
        n: 0,
        coefficients: [],
        verificationPoints: []
      },
      
      // Initialize batch processing state
      pendingMessages: [],
      batchSize: 10, // Default batch size
      batchTimeout: 50, // Default timeout in ms
      lastBatchTime: new Date(),
      processingBatch: false
    } as MPCState;
  }

  protected async onLeaveSession(session: Session): Promise<void> {
    // Trigger recovery mode if needed
    const state = session.state as MPCState;
    if (session.participants.length >= state.threshold) {
      state.recoveryMode = true;
      await this.initiateRecovery(session);
    }
    
    // Clean up state
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
      case MPCMessageType.SET_VALUE:
        await this.handleSetValueMessage(session, message);
        break;
      case MPCMessageType.SHARE:
        await this.handleShareMessage(session, message);
        break;
      case MPCMessageType.RESULT:
        await this.handleResultMessage(session, message);
        break;
      case MPCMessageType.RECOVERY:
        await this.handleRecoveryMessage(session, message);
        break;
      case MPCMessageType.VERIFY:
        await this.handleVerifyMessage(session, message);
        break;
      case MPCMessageType.COMMITMENT:
        await this.handleCommitmentMessage(session, message);
        break;
      default:
        throw this.createError(
          ProtocolErrorType.INVALID_MESSAGE,
          `Unknown message type: ${message.type}`
        );
    }
  }

  /**
   * Set local value for computation
   */
  public setLocalValue(value: Buffer): void {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as MPCState;
    
    // Blind the value before storing
    const blindedValue = this.blindValue(value);
    state.localValue = blindedValue;
    
    // Create backup share
    state.backupShares.set(this.state.localParticipant!.id, blindedValue);
    
    this.logAudit(session, 'LOCAL_VALUE_SET', {
      valueLength: value.length
    });
  }

  /**
   * Set computation type and start the computation
   */
  public async startComputation(type: MPCComputationType): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as MPCState;
    if (!state.localValue) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Local value not set');
    }

    state.computationType = type;

    // Share local value with all participants
    for (const participant of session.participants) {
      if (participant.id !== this.state.localParticipant?.id) {
        const message: Message = {
          type: MPCMessageType.SHARE,
          sender: this.state.localParticipant!.id,
          receiver: participant.id,
          content: state.localValue,
          timestamp: new Date()
        };
        await this.notifyMessageHandlers(message);
      }
    }
  }

  private async initiateRecovery(session: Session): Promise<void> {
    const state = session.state as MPCState;
    
    // Share backup values with remaining participants
    for (const participant of session.participants) {
      if (participant.id !== this.state.localParticipant?.id) {
        const message: Message = {
          type: MPCMessageType.RECOVERY,
          sender: this.state.localParticipant!.id,
          receiver: participant.id,
          content: state.backupShares.get(this.state.localParticipant!.id),
          timestamp: new Date()
        };
        await this.notifyMessageHandlers(message);
      }
    }
  }

  private async handleRecoveryMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as MPCState;
    state.backupShares.set(message.sender, message.content);

    // Check if we have enough shares for recovery
    if (state.backupShares.size >= state.threshold) {
      state.shares = new Map(state.backupShares);
      state.recoveryMode = false;

      // Recompute result
      if (state.computationType) {
        const result = this.computeResult(state);
        state.result = result;
        state.isComplete = true;
      }
    }
  }

  private computeResult(state: MPCState): Buffer {
    if (!state.localValue || !state.computationType) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Missing required state');
    }

    // Validate data integrity
    if (!this.validateDataIntegrity(state)) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Data integrity check failed');
    }

    // Convert all values to numbers
    const values = [state.localValue, ...state.shares.values()].map(
      buf => buf.readUInt8(0)
    );

    let result: number;
    switch (state.computationType) {
      case MPCComputationType.SUM:
        result = values.reduce((a, b) => a + b, 0);
        break;
      case MPCComputationType.AVERAGE:
        result = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case MPCComputationType.MAX:
        result = Math.max(...values);
        break;
      case MPCComputationType.MIN:
        result = Math.min(...values);
        break;
      case MPCComputationType.MEDIAN:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        break;
      case MPCComputationType.VARIANCE:
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        result = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
        break;
      case MPCComputationType.MODE:
        const frequency = new Map<number, number>();
        values.forEach(v => frequency.set(v, (frequency.get(v) || 0) + 1));
        let maxFreq = 0;
        let mode = values[0];
        frequency.forEach((freq, value) => {
          if (freq > maxFreq) {
            maxFreq = freq;
            mode = value;
          }
        });
        result = mode;
        break;
      case MPCComputationType.STD_DEV:
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
        result = Math.sqrt(variance);
        break;
      case MPCComputationType.QUARTILE:
        const sorted = [...values].sort((a, b) => a - b);
        const q2 = sorted[Math.floor(sorted.length / 2)];
        result = q2; // Returns median (Q2) for now
        break;
      case MPCComputationType.RANGE:
        result = Math.max(...values) - Math.min(...values);
        break;
      default:
        throw this.createError(
          ProtocolErrorType.INVALID_STATE,
          `Unknown computation type: ${state.computationType}`
        );
    }

    return Buffer.from([Math.floor(result)]);
  }

  /**
   * Validate data integrity using checksums
   */
  private validateDataIntegrity(state: MPCState): boolean {
    const computeChecksum = (data: Buffer): Buffer => {
      return createHash('sha256').update(data).digest();
    };

    // Verify local value
    if (state.localValue) {
      const localChecksum = computeChecksum(state.localValue);
      state.checksums.set(this.state.localParticipant!.id, localChecksum);
    }

    // Verify all shares
    for (const [participantId, share] of state.shares.entries()) {
      const checksum = state.checksums.get(participantId);
      if (!checksum || !checksum.equals(computeChecksum(share))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize threshold scheme
   */
  private initializeThresholdScheme(session: Session): void {
    const state = session.state as MPCState;
    const n = session.participants.length;
    const t = Math.ceil(n / 2); // Can be adjusted based on security requirements

    state.thresholdScheme = {
      t,
      n,
      coefficients: [],
      verificationPoints: []
    };

    // Generate random coefficients for the polynomial
    for (let i = 0; i < t; i++) {
      const coefficient = Buffer.alloc(32);
      crypto.randomFillSync(coefficient);
      state.thresholdScheme.coefficients.push(coefficient);
    }

    // Generate verification points
    for (let i = 1; i <= n; i++) {
      const point = this.evaluatePolynomial(i, state.thresholdScheme.coefficients);
      state.thresholdScheme.verificationPoints.push(point);
    }
  }

  /**
   * Evaluate polynomial at a given point
   */
  private evaluatePolynomial(x: number, coefficients: Buffer[]): Buffer {
    // Implementation of polynomial evaluation
    // This is a placeholder - actual implementation would use finite field arithmetic
    return Buffer.from([x]); // Simplified for demonstration
  }

  /**
   * Check if computation is complete
   */
  public isComplete(): boolean {
    const session = this.state.currentSession;
    if (!session) {
      return false;
    }

    return (session.state as MPCState).isComplete;
  }

  /**
   * Get computation result
   */
  public getResult(): Buffer | undefined {
    const session = this.state.currentSession;
    if (!session) {
      return undefined;
    }

    return (session.state as MPCState).result;
  }

  private async handleSetValueMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as MPCState;
    state.localValue = message.content;
  }

  private async handleShareMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as MPCState;
    
    // Store blinded share
    state.shares.set(message.sender, message.content);
    
    this.logAudit(session, 'SHARE_RECEIVED', {
      sender: message.sender
    });

    // Check if we have received all shares
    if (state.shares.size === session.participants.length - 1) {
      // Unblind all shares before computing result
      const unblindedShares = new Map<string, Buffer>();
      for (const [participantId, share] of state.shares) {
        unblindedShares.set(participantId, this.unblindValue(share));
      }
      state.shares = unblindedShares;
      
      // Compute result
      const result = this.computeResult(state);
      state.result = result;
      state.isComplete = true;

      this.logAudit(session, 'COMPUTATION_COMPLETED', {
        computationType: state.computationType
      });

      // Share result with all participants
      await this.broadcastResult(session, result);
    }
  }

  private async handleResultMessage(session: Session, message: Message): Promise<void> {
    const state = session.state as MPCState;
    state.result = message.content;
    state.isComplete = true;
  }

  private async handleVerifyMessage(session: Session, message: Message): Promise<void> {
    // Implementation of handleVerifyMessage
  }

  private async handleCommitmentMessage(session: Session, message: Message): Promise<void> {
    // Implementation of handleCommitmentMessage
  }

  /**
   * Start batch processing of messages
   */
  private startBatchProcessing(): void {
    if (this.batchProcessingInterval) {
      return;
    }

    this.batchProcessingInterval = setInterval(async () => {
      await this.processPendingMessages();
    }, 50); // Process every 50ms
  }

  /**
   * Process pending messages in batches
   */
  private async processPendingMessages(): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      return;
    }

    const state = session.state as MPCState;
    if (state.processingBatch || state.pendingMessages.length === 0) {
      return;
    }

    state.processingBatch = true;
    try {
      // Get next batch of messages
      const batch = state.pendingMessages.splice(0, state.batchSize);
      
      // Group messages by type for optimized processing
      const messagesByType = new Map<string, Message[]>();
      for (const message of batch) {
        const messages = messagesByType.get(message.type) || [];
        messages.push(message);
        messagesByType.set(message.type, messages);
      }

      // Process each message type in batch
      for (const [type, messages] of messagesByType) {
        await this.processBatch({ messages, timestamp: new Date() });
      }
    } finally {
      state.processingBatch = false;
    }
  }

  /**
   * Process a batch of messages
   */
  private async processBatch(batch: MessageBatch): Promise<void> {
    const session = this.state.currentSession;
    if (!session) {
      return;
    }

    const state = session.state as MPCState;
    const firstMessage = batch.messages[0];

    switch (firstMessage.type) {
      case MPCMessageType.SHARE:
        // Process all shares at once
        for (const message of batch.messages) {
          state.shares.set(message.sender, message.content);
        }
        
        // Check if we have all shares
        if (state.shares.size === session.participants.length - 1) {
          const result = this.computeResult(state);
          state.result = result;
          state.isComplete = true;

          // Notify all participants of the result
          await this.broadcastResult(session, result);
        }
        break;

      case MPCMessageType.RESULT:
        // Take the first result (they should all be the same)
        state.result = firstMessage.content;
        state.isComplete = true;
        break;

      // ... handle other message types ...
    }
  }

  /**
   * Broadcast result to all participants
   */
  private async broadcastResult(session: Session, result: Buffer): Promise<void> {
    const messages: Message[] = [];
    
    for (const participant of session.participants) {
      if (participant.id !== this.state.localParticipant?.id) {
        messages.push({
          type: MPCMessageType.RESULT,
          sender: this.state.localParticipant!.id,
          receiver: participant.id,
          content: result,
          timestamp: new Date()
        });
      }
    }

    // Send all result messages at once
    await Promise.all(messages.map(msg => this.notifyMessageHandlers(msg)));
  }

  /**
   * Set batch processing parameters
   */
  public setBatchParameters(batchSize: number, batchTimeout: number): void {
    const session = this.state.currentSession;
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    const state = session.state as MPCState;
    state.batchSize = batchSize;
    state.batchTimeout = batchTimeout;
  }

  private logAudit(session: Session, event: string, details: any = {}): void {
    const state = session.state as MPCState;
    const log: AuditLog = {
      timestamp: new Date(),
      event,
      participantId: this.state.localParticipant?.id || 'unknown',
      sessionId: session.id,
      details
    };
    state.auditLogs.push(log);
    this.logger.info(`Audit: ${event}`, log);
  }

  private blindValue(value: Buffer): Buffer {
    const session = this.state.currentSession!;
    const state = session.state as MPCState;
    
    // Generate blinding factor
    const blindingFactor = randomBytes(value.length);
    state.blindingFactors.set(this.state.localParticipant!.id, blindingFactor);
    
    // XOR the value with blinding factor
    const blinded = Buffer.alloc(value.length);
    for (let i = 0; i < value.length; i++) {
      blinded[i] = value[i] ^ blindingFactor[i];
    }
    
    return blinded;
  }

  private unblindValue(value: Buffer): Buffer {
    const session = this.state.currentSession!;
    const state = session.state as MPCState;
    
    // Get blinding factor
    const blindingFactor = state.blindingFactors.get(this.state.localParticipant!.id);
    if (!blindingFactor) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Missing blinding factor');
    }
    
    // XOR the value with blinding factor to unblind
    const unblinded = Buffer.alloc(value.length);
    for (let i = 0; i < value.length; i++) {
      unblinded[i] = value[i] ^ blindingFactor[i];
    }
    
    return unblinded;
  }
} 