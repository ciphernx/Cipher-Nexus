import { test, expect } from '@playwright/test';

test.describe('Dataset Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to datasets page', async ({ page }) => {
    await page.click('a:has-text("Datasets")');
    await expect(page).toHaveURL('/datasets');
    await expect(page.getByText('Manage Datasets')).toBeVisible();
  });

  test('should upload a new dataset', async ({ page }) => {
    await page.goto('/datasets');

    // Click upload button
    await page.click('button:has-text("Upload Dataset")');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-dataset.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,value\n1,test\n2,test2'),
    });

    // Fill in dataset details
    await page.fill('input[name="name"]', 'Test Dataset');
    await page.fill('textarea[name="description"]', 'A test dataset');
    await page.selectOption('select[name="type"]', 'tabular');

    // Submit form
    await page.click('button:has-text("Upload")');

    // Should show success message
    await expect(page.getByText('Dataset uploaded successfully')).toBeVisible();
    // Should show new dataset in list
    await expect(page.getByText('Test Dataset')).toBeVisible();
  });

  test('should filter datasets', async ({ page }) => {
    await page.goto('/datasets');

    // Apply filters
    await page.selectOption('select[name="type"]', 'tabular');
    await page.selectOption('select[name="status"]', 'ready');

    // Should update URL with filter params
    await expect(page).toHaveURL(/type=tabular/);
    await expect(page).toHaveURL(/status=ready/);

    // Should show filtered results
    await expect(page.getByText('No datasets found')).not.toBeVisible();
  });

  test('should view dataset details', async ({ page }) => {
    await page.goto('/datasets');

    // Click on a dataset
    await page.click('a:has-text("Test Dataset")');

    // Should navigate to details page
    await expect(page).toHaveURL(/\/datasets\/\d+/);

    // Should show dataset details
    await expect(page.getByText('Dataset Details')).toBeVisible();
    await expect(page.getByText('Test Dataset')).toBeVisible();
    await expect(page.getByText('Data Distribution')).toBeVisible();
  });

  test('should delete a dataset', async ({ page }) => {
    await page.goto('/datasets');

    // Click delete button
    await page.click('button[aria-label="Delete dataset"]');

    // Should show confirmation dialog
    await expect(page.getByText('Are you sure you want to delete this dataset?')).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Should show success message
    await expect(page.getByText('Dataset deleted successfully')).toBeVisible();
    // Dataset should be removed from list
    await expect(page.getByText('Test Dataset')).not.toBeVisible();
  });

  test('should handle dataset analysis', async ({ page }) => {
    await page.goto('/datasets');
    await page.click('a:has-text("Test Dataset")');

    // Click analyze button
    await page.click('button:has-text("Analyze")');

    // Should show loading state
    await expect(page.getByText('Analyzing dataset...')).toBeVisible();

    // Should show analysis results
    await expect(page.getByText('Analysis Results')).toBeVisible();
    await expect(page.getByText('Data Quality Score')).toBeVisible();
    await expect(page.getByText('Feature Correlation')).toBeVisible();
  });
}); 