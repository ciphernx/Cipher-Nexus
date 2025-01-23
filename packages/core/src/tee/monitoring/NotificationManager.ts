import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

export interface NotificationConfig {
  channels: {
    email?: {
      enabled: boolean;
      recipients: string[];
      smtpConfig?: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    slack?: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
    };
    webhook?: {
      enabled: boolean;
      url: string;
      headers?: Record<string, string>;
    };
  };
  throttling: {
    maxNotificationsPerMinute: number;
    cooldownPeriod: number;  // milliseconds
  };
}

export interface Notification {
  id: string;
  timestamp: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, any>;
  channels?: string[];
}

export class NotificationManager extends EventEmitter {
  private config: NotificationConfig;
  private notificationHistory: Map<string, Notification[]>;
  private channelThrottles: Map<string, number>;
  private readonly HISTORY_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(config: NotificationConfig) {
    super();
    this.config = config;
    this.notificationHistory = new Map();
    this.channelThrottles = new Map();

    // Start cleanup job
    setInterval(() => this.cleanupHistory(), this.HISTORY_RETENTION);
  }

  async sendNotification(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: Date.now()
    };

    try {
      // Store notification in history
      this.storeNotification(fullNotification);

      // Determine channels to send to
      const channels = notification.channels || this.determineChannels(notification);

      // Send to each channel
      await Promise.all(
        channels.map(channel => this.sendToChannel(channel, fullNotification))
      );

      this.emit('notification-sent', fullNotification);
      logger.info('Notification sent successfully', { notification: fullNotification });

    } catch (error) {
      logger.error('Failed to send notification', { notification: fullNotification }, error as Error);
      this.emit('notification-error', { notification: fullNotification, error });
    }
  }

  async getNotificationHistory(
    startTime: number,
    endTime: number = Date.now()
  ): Promise<Notification[]> {
    const allNotifications: Notification[] = [];
    
    for (const notifications of this.notificationHistory.values()) {
      allNotifications.push(
        ...notifications.filter(n => 
          n.timestamp >= startTime && n.timestamp <= endTime
        )
      );
    }

    return allNotifications.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async sendToChannel(
    channel: string,
    notification: Notification
  ): Promise<void> {
    // Check throttling
    if (this.isChannelThrottled(channel)) {
      logger.warn('Channel throttled, skipping notification', { channel, notification });
      return;
    }

    try {
      switch (channel) {
        case 'email':
          if (this.config.channels.email?.enabled) {
            await this.sendEmail(notification);
          }
          break;

        case 'slack':
          if (this.config.channels.slack?.enabled) {
            await this.sendSlack(notification);
          }
          break;

        case 'webhook':
          if (this.config.channels.webhook?.enabled) {
            await this.sendWebhook(notification);
          }
          break;

        default:
          logger.warn('Unknown notification channel', { channel });
      }

      this.updateChannelThrottle(channel);

    } catch (error) {
      logger.error('Failed to send notification to channel', 
        { channel, notification }, 
        error as Error
      );
      throw error;
    }
  }

  private async sendEmail(notification: Notification): Promise<void> {
    if (!this.config.channels.email?.smtpConfig) {
      throw new Error('SMTP configuration not provided');
    }

    // Here you would implement actual email sending logic
    // For example, using nodemailer
    logger.info('Sending email notification', { notification });
  }

  private async sendSlack(notification: Notification): Promise<void> {
    if (!this.config.channels.slack?.webhookUrl) {
      throw new Error('Slack webhook URL not provided');
    }

    const payload = {
      channel: this.config.channels.slack.channel,
      text: `*${notification.title}*\n${notification.message}`,
      attachments: [
        {
          color: this.getSeverityColor(notification.severity),
          fields: [
            {
              title: 'Severity',
              value: notification.severity,
              short: true
            },
            {
              title: 'Source',
              value: notification.source,
              short: true
            },
            ...(notification.metadata ? Object.entries(notification.metadata).map(([key, value]) => ({
              title: key,
              value: JSON.stringify(value),
              short: true
            })) : [])
          ]
        }
      ]
    };

    try {
      const response = await fetch(this.config.channels.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send Slack notification', { notification }, error as Error);
      throw error;
    }
  }

  private async sendWebhook(notification: Notification): Promise<void> {
    if (!this.config.channels.webhook?.url) {
      throw new Error('Webhook URL not provided');
    }

    try {
      const response = await fetch(this.config.channels.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.channels.webhook.headers
        },
        body: JSON.stringify(notification)
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send webhook notification', { notification }, error as Error);
      throw error;
    }
  }

  private determineChannels(notification: Omit<Notification, 'id' | 'timestamp'>): string[] {
    const channels: string[] = [];

    // Add channels based on severity and configuration
    if (notification.severity === 'critical' || notification.severity === 'error') {
      if (this.config.channels.email?.enabled) channels.push('email');
      if (this.config.channels.slack?.enabled) channels.push('slack');
    }

    if (this.config.channels.webhook?.enabled) {
      channels.push('webhook');
    }

    return channels;
  }

  private isChannelThrottled(channel: string): boolean {
    const lastNotification = this.channelThrottles.get(channel);
    if (!lastNotification) return false;

    const timeSinceLastNotification = Date.now() - lastNotification;
    return timeSinceLastNotification < this.config.throttling.cooldownPeriod;
  }

  private updateChannelThrottle(channel: string): void {
    this.channelThrottles.set(channel, Date.now());
  }

  private storeNotification(notification: Notification): void {
    const key = this.getStorageKey(notification.timestamp);
    if (!this.notificationHistory.has(key)) {
      this.notificationHistory.set(key, []);
    }
    this.notificationHistory.get(key)!.push(notification);
  }

  private cleanupHistory(): void {
    const cutoff = Date.now() - this.HISTORY_RETENTION;
    
    for (const [key, notifications] of this.notificationHistory.entries()) {
      // Remove old notifications
      const filteredNotifications = notifications.filter(n => n.timestamp >= cutoff);
      
      if (filteredNotifications.length === 0) {
        this.notificationHistory.delete(key);
      } else {
        this.notificationHistory.set(key, filteredNotifications);
      }
    }
  }

  private getStorageKey(timestamp: number): string {
    // Group notifications by day
    return new Date(timestamp).toISOString().split('T')[0];
  }

  private generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityColor(severity: Notification['severity']): string {
    switch (severity) {
      case 'critical':
        return '#FF0000';  // Red
      case 'error':
        return '#FF9900';  // Orange
      case 'warning':
        return '#FFCC00';  // Yellow
      default:
        return '#36A64F';  // Green
    }
  }
} 