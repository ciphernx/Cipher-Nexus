import { EventEmitter } from 'events';

interface WebSocketMessage {
  type: string;
  payload: any;
}

interface TrainingUpdate {
  taskId: string;
  status: string;
  metrics: {
    loss: number;
    accuracy: number;
    epoch: number;
    step: number;
    totalSteps: number;
    learningRate: number;
  };
  event?: {
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: string;
  };
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();

  constructor(private baseUrl: string) {
    super();
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.baseUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.resubscribe();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.cleanup();
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'training_update':
        const update: TrainingUpdate = message.payload;
        this.emit(`training_update:${update.taskId}`, update);
        break;
      case 'pong':
        // Handle pong response
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), timeout);
  }

  private resubscribe() {
    this.subscriptions.forEach((taskId) => {
      this.send({
        type: 'subscribe',
        payload: { taskId },
      });
    });
  }

  subscribeToTrainingUpdates(taskId: string) {
    this.subscriptions.add(taskId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        payload: { taskId },
      });
    }
  }

  unsubscribeFromTrainingUpdates(taskId: string) {
    this.subscriptions.delete(taskId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        payload: { taskId },
      });
    }
  }

  private send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Create a singleton instance
const wsService = new WebSocketService(process.env.REACT_APP_WS_URL || 'ws://localhost:8080/ws');

export default wsService; 