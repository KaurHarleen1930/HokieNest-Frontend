import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('can login with demo student account', async ({ page }) => {
    // Navigate to login
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL('/login');

    // Use demo student account
    await page.getByText('Use', { exact: true }).first().click();
    
    // Verify form is filled
    await expect(page.getByRole('textbox', { name: /vt email/i })).toHaveValue('jdoe@vt.edu');
    
    // Submit login
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back, John Doe!')).toBeVisible();
  });

  test('can signup with new VT email', async ({ page }) => {
    // Navigate to signup
    await page.getByRole('button', { name: 'Sign Up' }).click();
    await expect(page).toHaveURL('/signup');

    // Fill signup form
    await page.getByRole('textbox', { name: /full name/i }).fill('Test User');
    await page.getByRole('textbox', { name: /vt email/i }).fill(`test${Date.now()}@vt.edu`);
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    
    // Submit signup
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back, Test User!')).toBeVisible();
  });

  test('rejects non-VT email addresses', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    await page.getByRole('textbox', { name: /full name/i }).fill('Test User');
    await page.getByRole('textbox', { name: /vt email/i }).fill('test@gmail.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    
    await page.getByRole('button', { name: /sign up/i }).click();
    
    await expect(page.getByText(/must be a virginia tech email/i)).toBeVisible();
  });

  test('protects dashboard route from unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('can logout successfully', async ({ page }) => {
    // Login first
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByText('Use', { exact: true }).first().click();
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Open user menu and logout
    await page.getByRole('button', { name: /john doe/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    
    // Should redirect to home
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});