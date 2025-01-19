import { Buffer } from 'buffer';
import { Message, Participant, Session } from '../core/types';

/**
 * Protocol validator implementation
 */
export class ProtocolValidator {
  /**
   * Validate participant
   */
  public static validateParticipant(participant: Participant): void {
    if (!participant) {
      throw new Error('Participant is required');
    }

    if (!participant.id) {
      throw new Error('Participant ID is required');
    }

    if (!participant.publicKey || !(participant.publicKey instanceof Buffer)) {
      throw new Error('Participant public key must be a Buffer');
    }
  }

  /**
   * Validate session
   */
  public static validateSession(session: Session): void {
    if (!session) {
      throw new Error('Session is required');
    }

    if (!session.id) {
      throw new Error('Session ID is required');
    }

    if (!session.participants || !Array.isArray(session.participants)) {
      throw new Error('Session participants must be an array');
    }

    if (session.participants.length < 2) {
      throw new Error('Session must have at least 2 participants');
    }

    session.participants.forEach(participant => {
      this.validateParticipant(participant);
    });

    if (!session.startTime || !(session.startTime instanceof Date)) {
      throw new Error('Session start time must be a Date');
    }

    if (session.endTime && !(session.endTime instanceof Date)) {
      throw new Error('Session end time must be a Date');
    }
  }

  /**
   * Validate message
   */
  public static validateMessage(message: Message): void {
    if (!message) {
      throw new Error('Message is required');
    }

    if (!message.type) {
      throw new Error('Message type is required');
    }

    if (!message.sender) {
      throw new Error('Message sender is required');
    }

    if (!message.receiver) {
      throw new Error('Message receiver is required');
    }

    if (!message.content || !(message.content instanceof Buffer)) {
      throw new Error('Message content must be a Buffer');
    }

    if (message.signature && !(message.signature instanceof Buffer)) {
      throw new Error('Message signature must be a Buffer');
    }

    if (!message.timestamp || !(message.timestamp instanceof Date)) {
      throw new Error('Message timestamp must be a Date');
    }
  }

  /**
   * Validate buffer size
   */
  public static validateBufferSize(buffer: Buffer, expectedSize: number, name: string): void {
    if (!buffer || !(buffer instanceof Buffer)) {
      throw new Error(`${name} must be a Buffer`);
    }

    if (buffer.length !== expectedSize) {
      throw new Error(`${name} must be ${expectedSize} bytes`);
    }
  }

  /**
   * Validate number range
   */
  public static validateNumberRange(value: number, min: number, max: number, name: string): void {
    if (typeof value !== 'number') {
      throw new Error(`${name} must be a number`);
    }

    if (value < min || value > max) {
      throw new Error(`${name} must be between ${min} and ${max}`);
    }
  }

  /**
   * Validate array length
   */
  public static validateArrayLength(array: any[], min: number, max: number, name: string): void {
    if (!array || !Array.isArray(array)) {
      throw new Error(`${name} must be an array`);
    }

    if (array.length < min || array.length > max) {
      throw new Error(`${name} must have between ${min} and ${max} elements`);
    }
  }
} 