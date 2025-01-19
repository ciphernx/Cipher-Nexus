# Cipher Nexus API Documentation

## Overview

The Cipher Nexus API provides a comprehensive interface for interacting with the platform's core functionalities, including federated learning, privacy computing, data marketplace, and token economy features.

## Authentication

All API requests must include an authentication token in the Authorization header:

```bash
Authorization: Bearer <your-token>
```

## API Endpoints

### Federated Learning

#### Start Training Round
```http
POST /api/fl/rounds
Content-Type: application/json

{
  "modelId": "string",
  "minClients": number,
  "maxClients": number,
  "roundTimeout": number,
  "aggregationStrategy": "FedAvg" | "FedProx" | "FedMA"
}
```

#### Submit Model Update
```http
POST /api/fl/updates
Content-Type: application/json

{
  "roundId": "string",
  "clientId": "string",
  "modelUpdate": {
    "weights": Array<number>,
    "metrics": {
      "loss": number,
      "accuracy": number
    }
  }
}
```

### Privacy Computing

#### Initialize TEE
```http
POST /api/tee/init
Content-Type: application/json

{
  "enclaveType": "SGX" | "TrustZone",
  "memorySize": number,
  "threadCount": number
}
```

#### Execute in TEE
```http
POST /api/tee/execute
Content-Type: application/json

{
  "enclaveId": "string",
  "code": "string",
  "input": any
}
```

### Data Marketplace

#### List Data Asset
```http
POST /api/marketplace/assets
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "dataType": "string",
  "price": number,
  "metadata": {
    "size": number,
    "format": "string",
    "schema": object
  }
}
```

#### Purchase Data Access
```http
POST /api/marketplace/purchase
Content-Type: application/json

{
  "assetId": "string",
  "duration": number,
  "accessType": "read" | "train"
}
```

### Token Economy

#### Transfer Tokens
```http
POST /api/token/transfer
Content-Type: application/json

{
  "to": "string",
  "amount": "string",
  "memo": "string"
}
```

#### Stake Tokens
```http
POST /api/token/stake
Content-Type: application/json

{
  "amount": "string",
  "lockPeriod": number
}
```

## Error Handling

The API uses standard HTTP response codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

Error responses follow this format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": object
  }
}
```

## Rate Limiting

API requests are limited to:
- 100 requests per minute for authenticated users
- 10 requests per minute for unauthenticated users

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination using query parameters:

```http
GET /api/marketplace/assets?page=1&limit=10
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

## Websocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.cipher-nexus.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-token'
  }));
};
```

### Event Types

#### Training Progress
```javascript
{
  "type": "training.progress",
  "data": {
    "roundId": "string",
    "progress": number,
    "metrics": {
      "loss": number,
      "accuracy": number
    }
  }
}
```

#### Market Updates
```javascript
{
  "type": "market.update",
  "data": {
    "assetId": "string",
    "price": number,
    "volume": number
  }
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { CipherNexusClient } from '@ciphernx/client';

const client = new CipherNexusClient({
  apiKey: 'your-api-key',
  endpoint: 'https://api.cipher-nexus.com'
});

// Start training round
await client.federated.startRound({
  modelId: 'model-id',
  minClients: 10,
  maxClients: 100
});

// List marketplace assets
const assets = await client.marketplace.listAssets({
  page: 1,
  limit: 10
});
```

### Python
```python
from cipher_nexus import Client

client = Client(
    api_key='your-api-key',
    endpoint='https://api.cipher-nexus.com'
)

# Execute in TEE
result = client.tee.execute(
    enclave_id='enclave-id',
    code='your-code',
    input={'key': 'value'}
)

# Transfer tokens
tx = client.token.transfer(
    to='address',
    amount='1000000000000000000',
    memo='payment'
) 