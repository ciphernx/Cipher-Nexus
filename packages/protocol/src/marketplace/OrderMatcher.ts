import { EventEmitter } from 'events';

export interface Order {
  id: string;
  maker: string;
  assetId: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  filled: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface OrderBook {
  assetId: string;
  bids: Order[];  // Buy orders sorted by price desc
  asks: Order[];  // Sell orders sorted by price asc
}

export class OrderMatcher extends EventEmitter {
  private orders: Map<string, Order> = new Map();
  private orderBooks: Map<string, OrderBook> = new Map();

  constructor() {
    super();
  }

  async createSellOrder(
    owner: string,
    assetId: string,
    price: number,
    quantity: number
  ): Promise<Order> {
    try {
      // Validate inputs
      if (price <= 0 || quantity <= 0) {
        throw new Error('Invalid price or quantity');
      }

      // Create order
      const order: Order = {
        id: this.generateOrderId(),
        maker: owner,
        assetId,
        side: 'sell',
        price,
        quantity,
        filled: 0,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to orders map
      this.orders.set(order.id, order);

      // Add to order book
      let orderBook = this.orderBooks.get(assetId);
      if (!orderBook) {
        orderBook = {
          assetId,
          bids: [],
          asks: []
        };
        this.orderBooks.set(assetId, orderBook);
      }
      orderBook.asks.push(order);
      this.sortOrderBook(orderBook);

      // Try to match with existing buy orders
      await this.matchOrders(assetId);

      this.emit('orderCreated', {
        orderId: order.id,
        assetId,
        side: 'sell',
        price,
        quantity,
        timestamp: new Date()
      });

      return order;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async createBuyOrder(
    buyer: string,
    assetId: string,
    price: number,
    quantity: number
  ): Promise<Order> {
    try {
      // Validate inputs
      if (price <= 0 || quantity <= 0) {
        throw new Error('Invalid price or quantity');
      }

      // Create order
      const order: Order = {
        id: this.generateOrderId(),
        maker: buyer,
        assetId,
        side: 'buy',
        price,
        quantity,
        filled: 0,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add to orders map
      this.orders.set(order.id, order);

      // Add to order book
      let orderBook = this.orderBooks.get(assetId);
      if (!orderBook) {
        orderBook = {
          assetId,
          bids: [],
          asks: []
        };
        this.orderBooks.set(assetId, orderBook);
      }
      orderBook.bids.push(order);
      this.sortOrderBook(orderBook);

      // Try to match with existing sell orders
      await this.matchOrders(assetId);

      this.emit('orderCreated', {
        orderId: order.id,
        assetId,
        side: 'buy',
        price,
        quantity,
        timestamp: new Date()
      });

      return order;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getBestSellOrder(assetId: string): Promise<Order | undefined> {
    const orderBook = this.orderBooks.get(assetId);
    if (!orderBook || orderBook.asks.length === 0) {
      return undefined;
    }

    // Return the lowest ask price order
    return orderBook.asks[0];
  }

  async getBestBuyOrder(assetId: string): Promise<Order | undefined> {
    const orderBook = this.orderBooks.get(assetId);
    if (!orderBook || orderBook.bids.length === 0) {
      return undefined;
    }

    // Return the highest bid price order
    return orderBook.bids[0];
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'open') {
        throw new Error('Order cannot be cancelled');
      }

      // Update order status
      order.status = 'cancelled';
      order.updatedAt = new Date();

      // Remove from order book
      const orderBook = this.orderBooks.get(order.assetId);
      if (orderBook) {
        if (order.side === 'buy') {
          orderBook.bids = orderBook.bids.filter(o => o.id !== orderId);
        } else {
          orderBook.asks = orderBook.asks.filter(o => o.id !== orderId);
        }
      }

      this.emit('orderCancelled', {
        orderId,
        assetId: order.assetId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async listOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    return this.orders.get(orderId);
  }

  private async matchOrders(assetId: string): Promise<void> {
    const orderBook = this.orderBooks.get(assetId);
    if (!orderBook) return;

    while (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const bestBid = orderBook.bids[0];
      const bestAsk = orderBook.asks[0];

      if (bestBid.price >= bestAsk.price) {
        // Match found
        const matchQuantity = Math.min(
          bestBid.quantity - bestBid.filled,
          bestAsk.quantity - bestAsk.filled
        );

        // Update filled amounts
        bestBid.filled += matchQuantity;
        bestAsk.filled += matchQuantity;

        // Update status if fully filled
        if (bestBid.filled === bestBid.quantity) {
          bestBid.status = 'filled';
          orderBook.bids.shift();
        }
        if (bestAsk.filled === bestAsk.quantity) {
          bestAsk.status = 'filled';
          orderBook.asks.shift();
        }

        // Update timestamps
        bestBid.updatedAt = new Date();
        bestAsk.updatedAt = new Date();

        this.emit('orderMatched', {
          buyOrderId: bestBid.id,
          sellOrderId: bestAsk.id,
          assetId,
          price: bestAsk.price,
          quantity: matchQuantity,
          timestamp: new Date()
        });
      } else {
        // No more matches possible
        break;
      }
    }
  }

  private sortOrderBook(orderBook: OrderBook): void {
    // Sort bids by price descending (highest first)
    orderBook.bids.sort((a, b) => b.price - a.price);
    
    // Sort asks by price ascending (lowest first)
    orderBook.asks.sort((a, b) => a.price - b.price);
  }

  private generateOrderId(): string {
    return 'order_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 