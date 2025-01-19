import { test, expect } from '@playwright/test';

test.describe('Privacy Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to privacy settings', async ({ page }) => {
    await page.click('a:has-text("Privacy")');
    await expect(page).toHaveURL('/privacy');
    await expect(page.getByText('Privacy Settings')).toBeVisible();
  });

  test('should configure differential privacy settings', async ({ page }) => {
    await page.goto('/privacy');

    // Enable differential privacy
    await page.click('button[role="switch"][aria-label="Enable Differential Privacy"]');
    await expect(page.getByText('Differential Privacy enabled')).toBeVisible();

    // Configure epsilon value
    await page.fill('input[name="epsilon"]', '0.1');
    await page.fill('input[name="delta"]', '1e-5');
    await page.click('button:has-text("Apply")');

    // Should show success message
    await expect(page.getByText('Privacy settings updated successfully')).toBeVisible();

    // Check privacy score update
    await expect(page.getByText(/Privacy Score: \d+%/)).toBeVisible();
  });

  test('should configure homomorphic encryption', async ({ page }) => {
    await page.goto('/privacy');

    // Enable homomorphic encryption
    await page.click('button[role="switch"][aria-label="Enable Homomorphic Encryption"]');

    // Configure encryption parameters
    await page.selectOption('select[name="scheme"]', 'bfv');
    await page.fill('input[name="keySize"]', '2048');
    await page.click('button:has-text("Apply")');

    // Should show success message
    await expect(page.getByText('Encryption settings updated successfully')).toBeVisible();

    // Check security level
    await expect(page.getByText('Security Level: 128-bit')).toBeVisible();
  });

  test('should configure secure aggregation', async ({ page }) => {
    await page.goto('/privacy');

    // Enable secure aggregation
    await page.click('button[role="switch"][aria-label="Enable Secure Aggregation"]');

    // Configure aggregation parameters
    await page.fill('input[name="minParticipants"]', '3');
    await page.fill('input[name="threshold"]', '0.8');
    await page.click('button:has-text("Apply")');

    // Should show success message
    await expect(page.getByText('Aggregation settings updated successfully')).toBeVisible();
  });

  test('should handle privacy budget management', async ({ page }) => {
    await page.goto('/privacy/budget');

    // Check current budget
    await expect(page.getByText('Privacy Budget Overview')).toBeVisible();
    await expect(page.getByText(/Available Budget/)).toBeVisible();

    // Allocate budget
    await page.click('button:has-text("Allocate Budget")');
    await page.fill('input[name="amount"]', '0.5');
    await page.selectOption('select[name="model"]', 'Test Classification Model');
    await page.click('button:has-text("Confirm")');

    // Should show success message
    await expect(page.getByText('Budget allocated successfully')).toBeVisible();

    // Check budget history
    await expect(page.getByText('Budget History')).toBeVisible();
    await expect(page.getByText('Test Classification Model')).toBeVisible();
    await expect(page.getByText('0.5')).toBeVisible();
  });

  test('should perform privacy audit', async ({ page }) => {
    await page.goto('/privacy/audit');

    // Start privacy audit
    await page.click('button:has-text("Start Audit")');

    // Should show audit progress
    await expect(page.getByText('Privacy Audit in Progress')).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();

    // Wait for audit completion
    await expect(page.getByText('Audit completed')).toBeVisible({ timeout: 30000 });

    // Check audit results
    await expect(page.getByText('Audit Results')).toBeVisible();
    await expect(page.getByText('Privacy Compliance Score')).toBeVisible();
    await expect(page.getByText('Recommendations')).toBeVisible();
  });

  test('should configure data retention policies', async ({ page }) => {
    await page.goto('/privacy/retention');

    // Configure retention period
    await page.selectOption('select[name="retentionPeriod"]', '90');
    await page.click('button[role="switch"][aria-label="Enable Auto-deletion"]');
    await page.click('button:has-text("Save")');

    // Should show success message
    await expect(page.getByText('Retention policy updated successfully')).toBeVisible();

    // Check scheduled deletions
    await expect(page.getByText('Scheduled Deletions')).toBeVisible();
    await expect(page.getByText(/Next deletion scheduled for/)).toBeVisible();
  });

  test('should handle privacy incident response', async ({ page }) => {
    await page.goto('/privacy/incidents');

    // Create incident report
    await page.click('button:has-text("Report Incident")');
    await page.fill('input[name="title"]', 'Potential Data Leak');
    await page.fill('textarea[name="description"]', 'Suspicious access pattern detected');
    await page.selectOption('select[name="severity"]', 'high');
    await page.click('button:has-text("Submit")');

    // Should show confirmation
    await expect(page.getByText('Incident reported successfully')).toBeVisible();

    // Check incident tracking
    await expect(page.getByText('Incident Tracking')).toBeVisible();
    await expect(page.getByText('Potential Data Leak')).toBeVisible();
    await expect(page.getByText('High')).toBeVisible();
    await expect(page.getByText('Open')).toBeVisible();
  });
}); 