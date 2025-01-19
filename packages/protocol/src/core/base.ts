import { randomBytes } from 'crypto';
import {
  Protocol,
  ProtocolOptions,
  ProtocolState,
  Session,
  Participant,
  Message,
  ProtocolError,
  ProtocolErrorType
} from './types';

/**
 * Abstract base class for all protocols
 */
export abstract class BaseProtocol implements Protocol {
  protected state: ProtocolState;
  protected options: ProtocolOptions;

  constructor(options: ProtocolOptions = {}) {
    this.options = {
      timeout: 30000, // 30 seconds
      retryCount: 3,
      verifySignatures: true,
      logLevel: 'info',
      ...options
    };

    this.state = {
      isInitialized: false,
      isRunning: false,
      activeSessions: new Map(),
      messageHandlers: new Set(),
      errorHandlers: new Set()
    };
  }

  /**
   * Initialize the protocol
   */
  public async initialize(options?: ProtocolOptions): Promise<void> {
    if (this.state.isInitialized) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol already initialized');
    }

    if (options) {
      this.options = { ...this.options, ...options };
    }

    try {
      await this.onInitialize();
      this.state.isInitialized = true;
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to initialize protocol', error);
    }
  }

  /**
   * Start the protocol
   */
  public async start(): Promise<void> {
    if (!this.state.isInitialized) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not initialized');
    }

    if (this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol already running');
    }

    try {
      await this.onStart();
      this.state.isRunning = true;
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to start protocol', error);
    }
  }

  /**
   * Stop the protocol
   */
  public async stop(): Promise<void> {
    if (!this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not running');
    }

    try {
      await this.onStop();
      this.state.isRunning = false;
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to stop protocol', error);
    }
  }

  /**
   * Create a new protocol session
   */
  public async createSession(participants: Participant[]): Promise<Session> {
    if (!this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not running');
    }

    if (!participants || participants.length < 2) {
      throw this.createError(ProtocolErrorType.INVALID_PARTICIPANT, 'At least 2 participants required');
    }

    const session: Session = {
      id: this.generateSessionId(),
      participants,
      state: {},
      startTime: new Date()
    };

    try {
      await this.onCreateSession(session);
      this.state.activeSessions.set(session.id, session);
      this.state.currentSession = session;
      return session;
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to create session', error);
    }
  }

  /**
   * Join an existing protocol session
   */
  public async joinSession(sessionId: string): Promise<void> {
    if (!this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not running');
    }

    const session = this.state.activeSessions.get(sessionId);
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Session not found');
    }

    try {
      await this.onJoinSession(session);
      this.state.currentSession = session;
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to join session', error);
    }
  }

  /**
   * Leave the current protocol session
   */
  public async leaveSession(sessionId: string): Promise<void> {
    if (!this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not running');
    }

    const session = this.state.activeSessions.get(sessionId);
    if (!session) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Session not found');
    }

    try {
      await this.onLeaveSession(session);
      if (this.state.currentSession?.id === sessionId) {
        this.state.currentSession = undefined;
      }
      this.state.activeSessions.delete(sessionId);
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to leave session', error);
    }
  }

  /**
   * Send a message to other participants
   */
  public async sendMessage(message: Message): Promise<void> {
    if (!this.state.isRunning) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'Protocol not running');
    }

    if (!this.state.currentSession) {
      throw this.createError(ProtocolErrorType.INVALID_STATE, 'No active session');
    }

    try {
      await this.onSendMessage(message);
    } catch (error) {
      throw this.createError(ProtocolErrorType.INTERNAL_ERROR, 'Failed to send message', error);
    }
  }

  /**
   * Register a message handler
   */
  public onMessage(handler: (message: Message) => Promise<void>): void {
    this.state.messageHandlers.add(handler);
  }

  /**
   * Register an error handler
   */
  public onError(handler: (error: ProtocolError) => void): void {
    this.state.errorHandlers.add(handler);
  }

  // Protected methods that should be implemented by derived classes
  protected abstract onInitialize(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onCreateSession(session: Session): Promise<void>;
  protected abstract onJoinSession(session: Session): Promise<void>;
  protected abstract onLeaveSession(session: Session): Promise<void>;
  protected abstract onSendMessage(message: Message): Promise<void>;

  // Protected utility methods
  protected generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  protected createError(type: ProtocolErrorType, message: string, cause?: any): ProtocolError {
    const error = new Error(message) as ProtocolError;
    error.type = type;
    error.details = cause;
    this.notifyError(error);
    return error;
  }

  protected async notifyMessageHandlers(message: Message): Promise<void> {
    const promises = Array.from(this.state.messageHandlers).map(handler => handler(message));
    await Promise.all(promises);
  }

  protected notifyError(error: ProtocolError): void {
    this.state.errorHandlers.forEach(handler => handler(error));
  }
} 