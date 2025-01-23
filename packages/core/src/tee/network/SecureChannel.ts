import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { CryptoService } from '../crypto/CryptoService';
import { RemoteAttestationService, AttestationReport } from '../attestation/RemoteAttestationService';

export interface ChannelConfig {
  peerId: string;
  peerPublicKey: Buffer;
  attestationRequired: boolean;
  sessionTimeout: number;
  maxMessageSize: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ChannelMessage {
  id: string;
  timestamp: number;
  type: string;
  payload: Buffer;
  signature?: Buffer;
  attestation?: AttestationReport;
}

export interface ChannelState {
  isConnected: boolean;
  lastMessageTime: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}

export class SecureChannel extends EventEmitter {
  private readonly config: ChannelConfig;
  private readonly cryptoService: CryptoService;
  private readonly attestationService: RemoteAttestationService;
  private sessionKey: Buffer | null = null;
  private state: ChannelState;
  private messageQueue: ChannelMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor(
    config: ChannelConfig,
    cryptoService: CryptoService,
    attestationService: RemoteAttestationService
  ) {
    super();
    this.config = config;
    this.cryptoService = cryptoService;
    this.attestationService = attestationService;
    this.state = {
      isConnected: false,
      lastMessageTime: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0
    };

    // Start session management
    setInterval(() => this.manageSession(), 60000);
  }

  async connect(): Promise<void> {
    try {
      // Generate session key
      this.sessionKey = this.cryptoService.generateKey();

      // Perform attestation if required
      let attestation: AttestationReport | undefined;
      if (this.config.attestationRequired) {
        attestation = await this.attestationService.generateAttestationReport();
      }

      // Send connection request
      const connectionMessage: ChannelMessage = {
        id: this.generateMessageId(),
        timestamp: Date.now(),
        type: 'connection_request',
        payload: this.sessionKey,
        attestation
      };

      await this.sendMessage(connectionMessage);
      this.state.isConnected = true;

      this.emit('connected', { peerId: this.config.peerId });
      logger.info('Secure channel established', { peerId: this.config.peerId });

    } catch (error) {
      logger.error('Failed to establish secure channel', {}, error as Error);
      this.emit('connection-error', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.state.isConnected) {
        return;
      }

      // Send disconnect message
      const disconnectMessage: ChannelMessage = {
        id: this.generateMessageId(),
        timestamp: Date.now(),
        type: 'disconnect',
        payload: Buffer.from('disconnect')
      };

      await this.sendMessage(disconnectMessage);
      this.cleanup();

      this.emit('disconnected', { peerId: this.config.peerId });
      logger.info('Secure channel closed', { peerId: this.config.peerId });

    } catch (error) {
      logger.error('Error during channel disconnect', {}, error as Error);
      this.emit('disconnect-error', { error });
      throw error;
    }
  }

  async sendMessage(message: ChannelMessage): Promise<void> {
    try {
      if (!this.state.isConnected) {
        throw new Error('Channel not connected');
      }

      if (!this.sessionKey) {
        throw new Error('Session key not established');
      }

      if (message.payload.length > this.config.maxMessageSize) {
        throw new Error('Message exceeds maximum size');
      }

      // Sign message
      message.signature = (await this.cryptoService.encrypt(
        Buffer.from(message.id),
        this.sessionKey
      )).ciphertext;

      // Encrypt payload
      const encryptedPayload = await this.cryptoService.encrypt(
        message.payload,
        this.sessionKey
      );

      // Queue message for sending
      this.queueMessage({
        ...message,
        payload: encryptedPayload.ciphertext
      });

      this.state.messagesSent++;
      this.state.lastMessageTime = Date.now();

      this.emit('message-sent', {
        messageId: message.id,
        type: message.type
      });

      logger.debug('Message sent', {
        messageId: message.id,
        type: message.type,
        size: message.payload.length
      });

    } catch (error) {
      this.state.errors++;
      logger.error('Failed to send message', {}, error as Error);
      this.emit('message-error', { error });
      throw error;
    }
  }

  async receiveMessage(message: ChannelMessage): Promise<Buffer> {
    try {
      if (!this.state.isConnected) {
        throw new Error('Channel not connected');
      }

      if (!this.sessionKey) {
        throw new Error('Session key not established');
      }

      // Verify message signature
      if (!message.signature) {
        throw new Error('Message signature missing');
      }

      const isValid = await this.verifyMessageSignature(
        message.id,
        message.signature
      );

      if (!isValid) {
        throw new Error('Invalid message signature');
      }

      // Verify attestation if required
      if (this.config.attestationRequired && message.attestation) {
        const attestationResult = await this.attestationService.verifyAttestationReport(
          message.attestation
        );
        if (!attestationResult.isValid) {
          throw new Error('Invalid attestation report');
        }
      }

      // Decrypt payload
      const decryptedPayload = await this.cryptoService.decrypt(
        message.payload,
        this.sessionKey,
        Buffer.alloc(12), // IV
        Buffer.alloc(16)  // Tag
      );

      this.state.messagesReceived++;
      this.state.lastMessageTime = Date.now();

      this.emit('message-received', {
        messageId: message.id,
        type: message.type
      });

      logger.debug('Message received', {
        messageId: message.id,
        type: message.type,
        size: message.payload.length
      });

      return decryptedPayload.plaintext;

    } catch (error) {
      this.state.errors++;
      logger.error('Failed to receive message', {}, error as Error);
      this.emit('message-error', { error });
      throw error;
    }
  }

  getState(): ChannelState {
    return { ...this.state };
  }

  private async verifyMessageSignature(
    messageId: string,
    signature: Buffer
  ): Promise<boolean> {
    try {
      if (!this.sessionKey) {
        return false;
      }

      await this.cryptoService.decrypt(
        signature,
        this.sessionKey,
        Buffer.alloc(12), // IV
        Buffer.alloc(16)  // Tag
      );

      return true;
    } catch {
      return false;
    }
  }

  private queueMessage(message: ChannelMessage): void {
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.MAX_QUEUE_SIZE) {
      this.messageQueue.shift();
      logger.warn('Message queue overflow, dropping oldest message');
    }
  }

  private manageSession(): void {
    const now = Date.now();
    
    // Check session timeout
    if (this.state.isConnected &&
        now - this.state.lastMessageTime > this.config.sessionTimeout) {
      logger.warn('Session timeout, disconnecting', {
        peerId: this.config.peerId,
        lastMessageTime: this.state.lastMessageTime
      });
      this.disconnect().catch(error => {
        logger.error('Error during session timeout disconnect', {}, error as Error);
      });
    }

    // Cleanup old messages from queue
    this.messageQueue = this.messageQueue.filter(msg =>
      now - msg.timestamp < this.config.sessionTimeout
    );
  }

  private cleanup(): void {
    this.state.isConnected = false;
    this.sessionKey = null;
    this.messageQueue = [];
    this.state.lastMessageTime = 0;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
} 