import { Buffer } from 'buffer';

/**
 * Base interface for all protocol participants
 */
export interface Participant {
  id: string;
  publicKey: Buffer;
}

/**
 * Protocol session interface
 */
export interface Session {
  id: string;
  participants: string[];
  localParticipantId: string;
  startTime: Date;
  endTime?: Date;
}

/**
 * Protocol message interface
 */
export interface Message {
  session: Session;
  type: string;
  data?: any;
  senderId: string;
  receiverId: string;
  timestamp: Date;
}

/**
 * Protocol error types
 */
export enum ProtocolErrorType {
  INVALID_STATE = 'INVALID_STATE',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  INVALID_PARTICIPANT = 'INVALID_PARTICIPANT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Protocol error interface
 */
export interface ProtocolError extends Error {
  type: ProtocolErrorType;
  details?: any;
}

/**
 * Protocol options interface
 */
export interface ProtocolOptions {
  timeout?: number;
  retryCount?: number;
  verifySignatures?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Base protocol interface
 */
export interface Protocol {
  // Protocol lifecycle
  initialize(options?: ProtocolOptions): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Session management
  createSession(participants: Participant[]): Promise<Session>;
  joinSession(sessionId: string): Promise<void>;
  leaveSession(sessionId: string): Promise<void>;
  
  // Message handling
  sendMessage(message: Message): Promise<void>;
  onMessage(handler: (message: Message) => Promise<void>): void;
  
  // Error handling
  onError(handler: (error: ProtocolError) => void): void;
}

/**
 * Protocol state interface
 */
export interface ProtocolState {
  isInitialized: boolean;
  isRunning: boolean;
  currentSession?: Session;
  activeSessions: Map<string, Session>;
  messageHandlers: Set<(message: Message) => Promise<void>>;
  errorHandlers: Set<(error: ProtocolError) => void>;
} 