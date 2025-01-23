import { EventEmitter } from 'events';
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
  timestamp: string;
  level: LogLevel;
  module: string;
  function?: string;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  message: string;
  context: LogContext;
  stack?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  logDir: string;
  maxFiles: number;
  maxSize: number;
  retentionDays: number;
  console: boolean;
  structured: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  logDir: './logs',
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 30,
  console: true,
  structured: true
};

export class Logger extends EventEmitter {
  private static instance: Logger;
  private readonly config: LoggerConfig;
  private readonly logger: winston.Logger;
  private readonly auditLogger: winston.Logger;

  private constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = this.createLogger('app');
    this.auditLogger = this.createLogger('audit');
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private createLogger(type: 'app' | 'audit'): winston.Logger {
    const { logDir, maxFiles, maxSize, retentionDays, console: enableConsole } = this.config;
    
    // Create log directory if it doesn't exist
    const logPath = path.resolve(logDir);
    const filename = path.join(logPath, `${type}-%DATE%.log`);

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      this.config.structured
        ? winston.format.json()
        : winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const context = meta.context || {};
            return `${timestamp} [${level.toUpperCase()}] [${context.module}] ${message}`;
          })
    ];

    const transports: winston.transport[] = [
      new winston.transports.DailyRotateFile({
        filename,
        datePattern: 'YYYY-MM-DD',
        maxFiles: `${maxFiles}d`,
        maxSize,
        auditFile: path.join(logPath, `${type}-audit.json`),
        zippedArchive: true
      })
    ];

    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(...formats),
      transports
    });
  }

  error(message: string, context: Partial<LogContext> = {}, error?: Error): void {
    const logEntry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.logger.error(logEntry);
    this.emit('error', logEntry);
  }

  warn(message: string, context: Partial<LogContext> = {}): void {
    const logEntry = this.createLogEntry(LogLevel.WARN, message, context);
    this.logger.warn(logEntry);
    this.emit('warn', logEntry);
  }

  info(message: string, context: Partial<LogContext> = {}): void {
    const logEntry = this.createLogEntry(LogLevel.INFO, message, context);
    this.logger.info(logEntry);
    this.emit('info', logEntry);
  }

  debug(message: string, context: Partial<LogContext> = {}): void {
    const logEntry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.logger.debug(logEntry);
    this.emit('debug', logEntry);
  }

  trace(message: string, context: Partial<LogContext> = {}): void {
    const logEntry = this.createLogEntry(LogLevel.TRACE, message, context);
    this.logger.verbose(logEntry);
    this.emit('trace', logEntry);
  }

  auditLog(message: string, context: Partial<LogContext> = {}): void {
    const logEntry = this.createLogEntry(LogLevel.INFO, message, {
      ...context,
      audit: true
    });
    this.auditLogger.info(logEntry);
    this.emit('audit', logEntry);
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: Partial<LogContext> = {},
    error?: Error
  ): LogEntry {
    const timestamp = new Date().toISOString();
    const baseContext: LogContext = {
      timestamp,
      level,
      module: context.module || 'unknown',
      ...context
    };

    const logEntry: LogEntry = {
      message,
      context: baseContext
    };

    if (error) {
      logEntry.stack = error.stack;
      logEntry.context.errorMessage = error.message;
      logEntry.context.errorName = error.name;
    }

    return logEntry;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.logger.level = level;
    this.auditLogger.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  enableConsole(): void {
    this.config.console = true;
    this.logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    );
    this.auditLogger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    );
  }

  disableConsole(): void {
    this.config.console = false;
    this.logger.remove(winston.transports.Console);
    this.auditLogger.remove(winston.transports.Console);
  }

  setStructured(structured: boolean): void {
    this.config.structured = structured;
    // Recreate loggers with new format
    this.logger.clear();
    this.auditLogger.clear();
    this.logger.add(...this.createLogger('app').transports);
    this.auditLogger.add(...this.createLogger('audit').transports);
  }

  async query(options: {
    level?: LogLevel;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    module?: string;
    sessionId?: string;
    userId?: string;
    requestId?: string;
  }): Promise<LogEntry[]> {
    // TODO: Implement log querying from files
    // This would involve reading and parsing log files based on the query options
    return [];
  }

  async cleanup(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);

    // TODO: Implement log file cleanup
    // This would involve deleting log files older than the retention period
  }
} 