import { test, expect } from '@playwright/test';

test.describe('Model Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to models page', async ({ page }) => {
    await page.click('a:has-text("Models")');
    await expect(page).toHaveURL('/models');
    await expect(page.getByText('Model Management')).toBeVisible();
  });

  test('should create and train a new model', async ({ page }) => {
    await page.goto('/models');

    // Click create model button
    await page.click('button:has-text("Create Model")');

    // Fill in model details
    await page.fill('input[name="name"]', 'Test Classification Model');
    await page.fill('textarea[name="description"]', 'A test classification model');
    await page.selectOption('select[name="type"]', 'classification');
    await page.selectOption('select[name="dataset"]', 'Test Dataset');

    // Submit form
    await page.click('button:has-text("Create")');

    // Should show success message
    await expect(page.getByText('Model created successfully')).toBeVisible();

    // Configure training parameters
    await page.click('button:has-text("Train Model")');
    await page.fill('input[name="epochs"]', '100');
    await page.fill('input[name="batchSize"]', '32');
    await page.fill('input[name="learningRate"]', '0.001');
    await page.fill('input[name="privacyBudget"]', '1.0');

    // Start training
    await page.click('button:has-text("Start Training")');

    // Should show training progress
    await expect(page.getByText('Training in progress')).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();

    // Wait for training completion
    await expect(page.getByText('Training completed')).toBeVisible({ timeout: 30000 });
  });

  test('should monitor training progress and metrics', async ({ page }) => {
    await page.goto('/models/1/training');

    // Check training metrics
    await expect(page.getByText('Training Progress')).toBeVisible();
    await expect(page.getByText('Loss')).toBeVisible();
    await expect(page.getByText('Accuracy')).toBeVisible();
    await expect(page.getByText('Privacy Budget Used')).toBeVisible();

    // Check training history charts
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByText('Training History')).toBeVisible();

    // Check evaluation metrics
    await expect(page.getByText('Evaluation Metrics')).toBeVisible();
    await expect(page.getByText('Confusion Matrix')).toBeVisible();
  });

  test('should deploy trained model', async ({ page }) => {
    await page.goto('/models');
    await page.click('a:has-text("Test Classification Model")');

    // Click deploy button
    await page.click('button:has-text("Deploy")');

    // Configure deployment settings
    await page.fill('input[name="replicas"]', '2');
    await page.fill('input[name="cpuLimit"]', '1');
    await page.fill('input[name="memoryLimit"]', '2Gi');
    await page.selectOption('select[name="environment"]', 'production');

    // Confirm deployment
    await page.click('button:has-text("Confirm Deployment")');

    // Should show deployment progress
    await expect(page.getByText('Deployment in progress')).toBeVisible();

    // Wait for deployment completion
    await expect(page.getByText('Model deployed successfully')).toBeVisible({ timeout: 30000 });

    // Check deployment status
    await expect(page.getByText('Status: Running')).toBeVisible();
    await expect(page.getByText('Replicas: 2/2')).toBeVisible();
  });

  test('should monitor model performance', async ({ page }) => {
    await page.goto('/models/1/monitoring');

    // Check performance metrics
    await expect(page.getByText('Model Performance')).toBeVisible();
    await expect(page.getByText('Request Rate')).toBeVisible();
    await expect(page.getByText('Latency')).toBeVisible();
    await expect(page.getByText('Error Rate')).toBeVisible();

    // Check resource usage
    await expect(page.getByText('Resource Usage')).toBeVisible();
    await expect(page.getByText('CPU Usage')).toBeVisible();
    await expect(page.getByText('Memory Usage')).toBeVisible();

    // Check prediction distribution
    await expect(page.getByText('Prediction Distribution')).toBeVisible();
    await expect(page.locator('canvas').nth(1)).toBeVisible();
  });

  test('should handle model versioning', async ({ page }) => {
    await page.goto('/models/1/versions');

    // Check version history
    await expect(page.getByText('Version History')).toBeVisible();
    await expect(page.getByText('v1.0.0')).toBeVisible();

    // Create new version
    await page.click('button:has-text("Create Version")');
    await page.fill('input[name="version"]', 'v1.1.0');
    await page.fill('textarea[name="changes"]', 'Updated model architecture');
    await page.click('button:has-text("Create")');

    // Should show new version
    await expect(page.getByText('v1.1.0')).toBeVisible();

    // Rollback to previous version
    await page.getByText('v1.0.0').click();
    await page.click('button:has-text("Rollback")');
    await page.click('button:has-text("Confirm")');

    // Should show rollback success
    await expect(page.getByText('Rollback successful')).toBeVisible();
  });
}); 