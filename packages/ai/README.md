# @ciphernx/ai

Advanced AI module integrating cryptographic and protocol functionalities.

## Features

- Multiple model type support (TensorFlow, PyTorch, Scikit-learn, etc.)
- Data augmentation capabilities
- Model compression and optimization
- Distributed training support
- Model interpretability tools

## Installation

```bash
npm install @ciphernx/ai
```

Or install from the repository:

```bash
npm run setup
```

## Usage

See the examples directory for detailed usage examples. Here's a quick start:

```typescript
import { ModelFactory, ModelType, TaskType } from '@ciphernx/ai';

async function main() {
  const model = await ModelFactory.createModel({
    type: ModelType.TENSORFLOW,
    path: 'models/classifier',
    inputShape: [28, 28, 1],
    outputShape: [10],
    taskType: TaskType.CLASSIFICATION
  });

  // Train the model
  // ...
}
```

## Development

1. Install dependencies:
```bash
npm run setup
```

2. Build the package:
```bash
npm run build
```

3. Run tests:
```bash
npm test
```

4. Run example:
```bash
npm run example
```

## License

MIT 