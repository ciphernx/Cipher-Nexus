import * as winston from 'winston';
import * as path from 'path';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogContext {
  [key: string]: any;
}

class Logger {
  private readonly logger: winston.Logger;
  private readonly auditLogger: winston.Logger;

  constructor() {
    // Create main logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true
        })
      ]
    });

    // Create audit logger
    this.auditLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/audit.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true
        })
      ]
    });
  }

  error(message: string, context: LogContext = {}, error?: Error): void {
    this.logger.error(message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }

  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.logger.info(message, context);
  }

  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(message, context);
  }

  trace(message: string, context: LogContext = {}): void {
    this.logger.silly(message, context);
  }

  auditLog(
    event: string,
    details: Record<string, any>,
    context: LogContext = {}
  ): void {
    this.auditLogger.info(event, {
      ...context,
      details,
      timestamp: new Date().toISOString()
    });
  }

  setLogLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  enableConsole(enabled: boolean): void {
    const consoleTransport = this.logger.transports.find(
      t => t instanceof winston.transports.Console
    );

    if (enabled && !consoleTransport) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    } else if (!enabled && consoleTransport) {
      this.logger.remove(consoleTransport);
    }
  }
}

// Export singleton instance
export const logger = new Logger(); 