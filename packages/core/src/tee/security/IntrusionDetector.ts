import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

export enum ThreatLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  level: ThreatLevel;
  details: Record<string, any>;
  signature?: string;
  context?: Record<string, any>;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  pattern: string | RegExp;
  level: ThreatLevel;
  category: string;
  enabled: boolean;
  context?: string[];
  action?: 'ALERT' | 'BLOCK' | 'LOG';
}

export interface ThreatIndicator {
  id: string;
  type: string;
  value: string;
  confidence: number;
  source: string;
  lastSeen: number;
  tags: string[];
}

export class IntrusionDetector extends EventEmitter {
  private rules: Map<string, DetectionRule>;
  private indicators: Map<string, ThreatIndicator>;
  private recentEvents: SecurityEvent[];
  private readonly maxEventHistory: number;
  private readonly analysisInterval: NodeJS.Timeout;

  constructor(maxEventHistory: number = 10000) {
    super();
    this.rules = new Map();
    this.indicators = new Map();
    this.recentEvents = [];
    this.maxEventHistory = maxEventHistory;

    // Start periodic analysis
    this.analysisInterval = setInterval(
      () => this.analyzePatterns(),
      60000 // Run analysis every minute
    );
  }

  addRule(rule: DetectionRule): void {
    try {
      this.validateRule(rule);
      this.rules.set(rule.id, rule);
      logger.info('Detection rule added', { ruleId: rule.id, name: rule.name });
    } catch (error) {
      logger.error('Failed to add detection rule', { rule }, error as Error);
      throw error;
    }
  }

  addThreatIndicator(indicator: ThreatIndicator): void {
    this.indicators.set(indicator.id, indicator);
    logger.info('Threat indicator added', {
      id: indicator.id,
      type: indicator.type
    });
  }

  async analyzeEvent(event: SecurityEvent): Promise<void> {
    try {
      // Add event to history
      this.addEventToHistory(event);

      // Check against detection rules
      for (const rule of this.rules.values()) {
        if (!rule.enabled) continue;

        if (await this.matchRule(rule, event)) {
          await this.handleThreat(rule, event);
        }
      }

      // Check against threat indicators
      for (const indicator of this.indicators.values()) {
        if (await this.matchIndicator(indicator, event)) {
          await this.handleIndicatorMatch(indicator, event);
        }
      }

    } catch (error) {
      logger.error('Failed to analyze security event', 
        { eventId: event.id }, 
        error as Error
      );
    }
  }

  private async matchRule(rule: DetectionRule, event: SecurityEvent): Promise<boolean> {
    try {
      // Check pattern match
      if (typeof rule.pattern === 'string') {
        return event.type === rule.pattern;
      } else {
        return rule.pattern.test(JSON.stringify(event));
      }
    } catch (error) {
      logger.error('Rule matching failed', 
        { ruleId: rule.id, eventId: event.id }, 
        error as Error
      );
      return false;
    }
  }

  private async matchIndicator(
    indicator: ThreatIndicator,
    event: SecurityEvent
  ): Promise<boolean> {
    try {
      // Check if event contains indicator value
      const eventString = JSON.stringify(event);
      return eventString.includes(indicator.value);
    } catch (error) {
      logger.error('Indicator matching failed',
        { indicatorId: indicator.id, eventId: event.id },
        error as Error
      );
      return false;
    }
  }

  private async handleThreat(rule: DetectionRule, event: SecurityEvent): Promise<void> {
    // Create threat alert
    const threat = {
      id: `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      rule: rule.id,
      event: event.id,
      level: rule.level,
      details: {
        ruleName: rule.name,
        category: rule.category,
        eventType: event.type,
        source: event.source
      }
    };

    // Emit threat detection event
    this.emit('threat-detected', threat);

    // Handle based on rule action
    switch (rule.action) {
      case 'BLOCK':
        await this.blockThreat(threat);
        break;
      case 'ALERT':
        await this.alertThreat(threat);
        break;
      case 'LOG':
      default:
        logger.warn('Threat detected', { threat });
    }
  }

  private async handleIndicatorMatch(
    indicator: ThreatIndicator,
    event: SecurityEvent
  ): Promise<void> {
    // Update indicator last seen
    indicator.lastSeen = Date.now();

    // Create indicator match alert
    const match = {
      id: `indicator-match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      indicator: indicator.id,
      event: event.id,
      confidence: indicator.confidence,
      details: {
        indicatorType: indicator.type,
        indicatorValue: indicator.value,
        eventType: event.type,
        source: event.source
      }
    };

    this.emit('indicator-match', match);
    logger.warn('Threat indicator matched', { match });
  }

  private async blockThreat(threat: any): Promise<void> {
    // Implement threat blocking logic
    logger.info('Blocking threat', { threat });
    this.emit('threat-blocked', threat);
  }

  private async alertThreat(threat: any): Promise<void> {
    // Implement threat alerting logic
    logger.warn('Alerting threat', { threat });
    this.emit('threat-alert', threat);
  }

  private addEventToHistory(event: SecurityEvent): void {
    this.recentEvents.push(event);
    
    // Trim history if needed
    if (this.recentEvents.length > this.maxEventHistory) {
      this.recentEvents = this.recentEvents.slice(-this.maxEventHistory);
    }
  }

  private async analyzePatterns(): Promise<void> {
    try {
      // Analyze event patterns for potential threats
      const patterns = await this.detectAnomalousPatterns();
      
      if (patterns.length > 0) {
        logger.info('Anomalous patterns detected', { patterns });
        this.emit('anomalous-patterns', patterns);
      }
    } catch (error) {
      logger.error('Pattern analysis failed', {}, error as Error);
    }
  }

  private async detectAnomalousPatterns(): Promise<any[]> {
    // Implement pattern detection logic
    const patterns: any[] = [];
    
    // Analyze event frequency
    const frequencyPatterns = await this.analyzeEventFrequency();
    patterns.push(...frequencyPatterns);
    
    // Analyze event sequences
    const sequencePatterns = await this.analyzeEventSequences();
    patterns.push(...sequencePatterns);
    
    return patterns;
  }

  private async analyzeEventFrequency(): Promise<any[]> {
    const patterns: any[] = [];
    const timeWindow = 300000; // 5 minutes
    const now = Date.now();
    
    // Group events by type
    const eventsByType = new Map<string, SecurityEvent[]>();
    for (const event of this.recentEvents) {
      if (now - event.timestamp <= timeWindow) {
        const events = eventsByType.get(event.type) || [];
        events.push(event);
        eventsByType.set(event.type, events);
      }
    }
    
    // Check for unusual frequencies
    for (const [type, events] of eventsByType.entries()) {
      if (events.length > 100) { // Threshold for 5-minute window
        patterns.push({
          type: 'high-frequency',
          eventType: type,
          count: events.length,
          timeWindow
        });
      }
    }
    
    return patterns;
  }

  private async analyzeEventSequences(): Promise<any[]> {
    const patterns: any[] = [];
    const sequenceWindow = 10; // Look for sequences of 10 events
    
    // Analyze recent events for suspicious sequences
    for (let i = 0; i <= this.recentEvents.length - sequenceWindow; i++) {
      const sequence = this.recentEvents.slice(i, i + sequenceWindow);
      
      // Check for suspicious patterns
      if (this.isSequenceSuspicious(sequence)) {
        patterns.push({
          type: 'suspicious-sequence',
          events: sequence.map(e => e.type),
          startTime: sequence[0].timestamp,
          endTime: sequence[sequence.length - 1].timestamp
        });
      }
    }
    
    return patterns;
  }

  private isSequenceSuspicious(sequence: SecurityEvent[]): boolean {
    // Implement sequence analysis logic
    // This is a simple example - implement more sophisticated detection
    const uniqueTypes = new Set(sequence.map(e => e.type));
    return uniqueTypes.size === 1 && sequence.length >= 10;
  }

  private validateRule(rule: DetectionRule): void {
    if (!rule.id || !rule.pattern || !rule.level) {
      throw new Error('Invalid detection rule: missing required fields');
    }
    
    if (typeof rule.pattern === 'string') {
      if (!rule.pattern.trim()) {
        throw new Error('Invalid detection rule: empty pattern');
      }
    } else if (!(rule.pattern instanceof RegExp)) {
      throw new Error('Invalid detection rule: pattern must be string or RegExp');
    }
  }

  shutdown(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    this.rules.clear();
    this.indicators.clear();
    this.recentEvents = [];
  }
} 