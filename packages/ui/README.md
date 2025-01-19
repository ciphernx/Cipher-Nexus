# @ciphernx/ui

Modern UI components for AI model management and visualization.

## Features

- Model management dashboard
- Training configuration form
- Model metrics visualization
- Material-UI based components
- Responsive design
- Dark mode support

## Installation

```bash
npm install @ciphernx/ui
```

## Usage

```tsx
import { ThemeProvider } from '@mui/material/styles';
import { Dashboard, theme } from '@ciphernx/ui';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Dashboard />
    </ThemeProvider>
  );
}
```

## Components

### ModelCard

Display model information and status:

```tsx
import { ModelCard } from '@ciphernx/ui';

<ModelCard
  name="My Model"
  type={ModelType.TENSORFLOW}
  task={TaskType.CLASSIFICATION}
  accuracy={0.95}
  status="ready"
  onTrain={() => {}}
  onDelete={() => {}}
/>
```

### TrainingForm

Configure and start model training:

```tsx
import { TrainingForm } from '@ciphernx/ui';

<TrainingForm
  onSubmit={(config) => {
    console.log('Training config:', config);
  }}
/>
```

### ModelMetrics

Visualize training metrics:

```tsx
import { ModelMetrics } from '@ciphernx/ui';

<ModelMetrics
  metrics={[
    {
      epoch: 1,
      loss: 0.5,
      accuracy: 0.8,
      valLoss: 0.6,
      valAccuracy: 0.75
    },
    // ...
  ]}
/>
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build the package:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

5. Run Storybook:
```bash
npm run storybook
```

## License

MIT 