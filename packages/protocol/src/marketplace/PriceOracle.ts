import { EventEmitter } from 'events';
import { createHash } from 'crypto';

interface PriceFeed {
  id: string;
  source: string;
  assetId: string;
  price: number;
  timestamp: Date;
  confidence: number;
  volume?: number;
  metadata?: Record<string, any>;
}

interface AggregatedPrice {
  assetId: string;
  price: number;
  timestamp: Date;
  confidence: number;
  sources: string[];
  deviation: number;
  volume: number;
}

interface PriceHistory {
  assetId: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  prices: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export class PriceOracle extends EventEmitter {
  private feeds: Map<string, PriceFeed[]> = new Map();
  private aggregatedPrices: Map<string, AggregatedPrice> = new Map();
  private priceHistory: Map<string, Map<string, PriceHistory>> = new Map();
  
  private readonly CONFIDENCE_THRESHOLD = 0.8;
  private readonly MAX_PRICE_DEVIATION = 0.1; // 10%
  private readonly MIN_REQUIRED_SOURCES = 3;
  private readonly HISTORY_RETENTION_DAYS = 30;

  constructor() {
    super();
    this.startHistoryCleanup();
  }

  async submitPrice(
    source: string,
    assetId: string,
    price: number,
    confidence: number,
    volume?: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const feedId = this.generateFeedId(source, assetId);
      
      const feed: PriceFeed = {
        id: feedId,
        source,
        assetId,
        price,
        timestamp: new Date(),
        confidence,
        volume,
        metadata
      };

      // Store feed
      let assetFeeds = this.feeds.get(assetId) || [];
      assetFeeds = assetFeeds.filter(f => f.source !== source); // Remove old feed from same source
      assetFeeds.push(feed);
      this.feeds.set(assetId, assetFeeds);

      // Aggregate prices
      await this.aggregatePrices(assetId);

      // Update price history
      await this.updatePriceHistory(assetId);

      this.emit('priceSubmitted', {
        feedId,
        assetId,
        source,
        price,
        timestamp: feed.timestamp
      });

      return feedId;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getPrice(assetId: string): Promise<AggregatedPrice | undefined> {
    return this.aggregatedPrices.get(assetId);
  }

  async getPriceHistory(
    assetId: string,
    interval: PriceHistory['interval'],
    limit?: number
  ): Promise<PriceHistory | undefined> {
    const assetHistory = this.priceHistory.get(assetId);
    if (!assetHistory) {
      return undefined;
    }

    const history = assetHistory.get(interval);
    if (!history) {
      return undefined;
    }

    if (limit) {
      return {
        ...history,
        prices: history.prices.slice(-limit)
      };
    }

    return history;
  }

  async getFeeds(assetId: string): Promise<PriceFeed[]> {
    return this.feeds.get(assetId) || [];
  }

  private async aggregatePrices(assetId: string): Promise<void> {
    const feeds = this.feeds.get(assetId) || [];
    
    // Filter recent and high confidence feeds
    const now = new Date();
    const recentFeeds = feeds.filter(feed => {
      const age = now.getTime() - feed.timestamp.getTime();
      return age <= 5 * 60 * 1000 && feed.confidence >= this.CONFIDENCE_THRESHOLD;
    });

    if (recentFeeds.length < this.MIN_REQUIRED_SOURCES) {
      return;
    }

    // Calculate median price
    const prices = recentFeeds.map(f => f.price).sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)];

    // Check price deviation
    const validFeeds = recentFeeds.filter(feed => {
      const deviation = Math.abs(feed.price - medianPrice) / medianPrice;
      return deviation <= this.MAX_PRICE_DEVIATION;
    });

    if (validFeeds.length < this.MIN_REQUIRED_SOURCES) {
      return;
    }

    // Calculate aggregated price
    const totalConfidence = validFeeds.reduce((sum, feed) => sum + feed.confidence, 0);
    const weightedPrice = validFeeds.reduce((sum, feed) => {
      return sum + (feed.price * feed.confidence / totalConfidence);
    }, 0);

    // Calculate price deviation
    const deviation = validFeeds.reduce((sum, feed) => {
      return sum + Math.abs(feed.price - weightedPrice) / weightedPrice;
    }, 0) / validFeeds.length;

    // Calculate total volume
    const totalVolume = validFeeds.reduce((sum, feed) => sum + (feed.volume || 0), 0);

    const aggregatedPrice: AggregatedPrice = {
      assetId,
      price: weightedPrice,
      timestamp: now,
      confidence: totalConfidence / validFeeds.length,
      sources: validFeeds.map(f => f.source),
      deviation,
      volume: totalVolume
    };

    this.aggregatedPrices.set(assetId, aggregatedPrice);

    this.emit('priceAggregated', {
      assetId,
      price: weightedPrice,
      timestamp: now,
      sources: validFeeds.length
    });
  }

  private async updatePriceHistory(assetId: string): Promise<void> {
    const aggregatedPrice = this.aggregatedPrices.get(assetId);
    if (!aggregatedPrice) {
      return;
    }

    const assetHistory = this.priceHistory.get(assetId) || new Map();
    const intervals: PriceHistory['interval'][] = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const interval of intervals) {
      let history = assetHistory.get(interval);
      if (!history) {
        history = {
          assetId,
          interval,
          prices: []
        };
      }

      const lastPrice = history.prices[history.prices.length - 1];
      const intervalMs = this.getIntervalMilliseconds(interval);

      if (!lastPrice || 
          aggregatedPrice.timestamp.getTime() - lastPrice.timestamp.getTime() >= intervalMs) {
        // Create new candle
        history.prices.push({
          timestamp: aggregatedPrice.timestamp,
          open: aggregatedPrice.price,
          high: aggregatedPrice.price,
          low: aggregatedPrice.price,
          close: aggregatedPrice.price,
          volume: aggregatedPrice.volume
        });
      } else {
        // Update last candle
        const currentPrice = history.prices[history.prices.length - 1];
        currentPrice.high = Math.max(currentPrice.high, aggregatedPrice.price);
        currentPrice.low = Math.min(currentPrice.low, aggregatedPrice.price);
        currentPrice.close = aggregatedPrice.price;
        currentPrice.volume += aggregatedPrice.volume;
      }

      assetHistory.set(interval, history);
    }

    this.priceHistory.set(assetId, assetHistory);
  }

  private getIntervalMilliseconds(interval: PriceHistory['interval']): number {
    const intervals: Record<PriceHistory['interval'], number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval];
  }

  private startHistoryCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const retentionMs = this.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      for (const [assetId, assetHistory] of this.priceHistory.entries()) {
        for (const [interval, history] of assetHistory.entries()) {
          history.prices = history.prices.filter(price => 
            now.getTime() - price.timestamp.getTime() <= retentionMs
          );
          assetHistory.set(interval, history);
        }
        this.priceHistory.set(assetId, assetHistory);
      }
    }, 24 * 60 * 60 * 1000); // Clean up daily
  }

  private generateFeedId(source: string, assetId: string): string {
    const hash = createHash('sha256');
    hash.update(source + assetId + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }
} 