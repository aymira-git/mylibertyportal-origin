import { test, expect } from '@playwright/test';

test.describe('MyLiberty Portal - Smoke & Auth Suite', () => {
  test('loads the portal and renders staff login view', async ({ page }) => {
    await page.goto('/');

    // Validate page title
    await expect(page).toHaveTitle(/MYLIBERTY Portal/i);

    // Validate main headers and welcome text
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    // Validate email and password inputs
    const emailInput = page.getByPlaceholder('teacher@myliberty.com');
    const passwordInput = page.getByPlaceholder('••••••••••••');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Validate submit button
    const submitBtn = page.getByRole('button', { name: /Sign In to Dashboard/i });
    await expect(submitBtn).toBeVisible();

    // Verify interaction
    await emailInput.fill('admin@myliberty.com');
    await expect(emailInput).toHaveValue('admin@myliberty.com');

    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveValue('secret123');
  });

  test('opens and closes password reset modal', async ({ page }) => {
    await page.goto('/');

    // Click "Forgot password?"
    const forgotBtn = page.getByRole('button', { name: /Forgot password\?/i });
    await expect(forgotBtn).toBeVisible();
    await forgotBtn.click();

    // Reset password dialog should appear
    await expect(page.getByRole('heading', { name: /Reset Password/i })).toBeVisible();
    await expect(page.getByPlaceholder('name@myliberty.com')).toBeVisible();

    // Close modal via Cancel button
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    await cancelBtn.click();

    // Modal should be dismissed
    await expect(page.getByRole('heading', { name: /Reset Password/i })).not.toBeVisible();
  });

  test('toggles password visibility', async ({ page }) => {
    await page.goto('/');

    const passwordInput = page.getByPlaceholder('••••••••••••');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle to visible
    const showToggle = page.getByRole('button', { name: /Show password/i });
    await showToggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Toggle back to hidden
    const hideToggle = page.getByRole('button', { name: /Hide password/i });
    await hideToggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
