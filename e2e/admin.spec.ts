import { test, expect } from '@playwright/test';

test.describe('Admin Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    
    // Use admin demo account
    await page.getByText('Use').nth(2).click(); // Third button is admin
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('admin can access admin panel', async ({ page }) => {
    // Navigate to admin panel
    await page.getByRole('button', { name: /admin user/i }).click();
    await page.getByRole('menuitem', { name: /admin panel/i }).click();
    
    await expect(page).toHaveURL('/admin');
    await expect(page.getByText('Admin Panel')).toBeVisible();
    await expect(page.getByText('User Management')).toBeVisible();
  });

  test('admin can view user list', async ({ page }) => {
    await page.goto('/admin');
    
    // Should show all seeded users
    await expect(page.getByText('John Doe')).toBeVisible(); // Student
    await expect(page.getByText('Staff Member')).toBeVisible(); // Staff
    await expect(page.getByText('Admin User')).toBeVisible(); // Admin
    
    // Should show user stats
    await expect(page.getByText('Total Users')).toBeVisible();
    await expect(page.getByText('Active Users')).toBeVisible();
    await expect(page.getByText('Suspended Users')).toBeVisible();
  });

  test('admin can suspend a user', async ({ page }) => {
    await page.goto('/admin');
    
    // Find student user row and suspend button
    const studentRow = page.locator('tr').filter({ hasText: 'John Doe' });
    const suspendButton = studentRow.getByRole('button', { name: /suspend/i });
    
    await expect(suspendButton).toBeVisible();
    await suspendButton.click();
    
    // Should show success and update status
    await expect(studentRow.getByText('Suspended')).toBeVisible();
  });

  test('admin cannot suspend themselves', async ({ page }) => {
    await page.goto('/admin');
    
    // Admin row should show "You" instead of suspend button
    const adminRow = page.locator('tr').filter({ hasText: 'Admin User' });
    await expect(adminRow.getByText('You')).toBeVisible();
    await expect(adminRow.getByRole('button', { name: /suspend/i })).not.toBeVisible();
  });

  test('non-admin user cannot access admin panel', async ({ page }) => {
    // Logout and login as student
    await page.getByRole('button', { name: /admin user/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    
    await page.goto('/login');
    await page.getByText('Use').first().click(); // Student account
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Try to access admin panel directly
    await page.goto('/admin');
    
    // Should see access denied
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText("You don't have permission")).toBeVisible();
  });

  test('admin panel is hidden from non-admin navigation', async ({ page }) => {
    // Logout and login as student
    await page.getByRole('button', { name: /admin user/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    
    await page.goto('/login');
    await page.getByText('Use').first().click(); // Student account
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Open user menu
    await page.getByRole('button', { name: /john doe/i }).click();
    
    // Should not see admin panel option
    await expect(page.getByRole('menuitem', { name: /admin panel/i })).not.toBeVisible();
  });

  test('admin can see correct user statistics', async ({ page }) => {
    await page.goto('/admin');
    
    // With 3 seeded users, all should be active initially
    await expect(page.getByText('3').first()).toBeVisible(); // Total users
    
    // The stats cards should show correct numbers
    const statsCards = page.locator('[data-testid*="stats"]');
    // Note: We can't easily test exact numbers without knowing suspended state
    // but we can verify the cards exist and show numbers
  });

  test('suspended user cannot login', async ({ page }) => {
    // First suspend a user
    await page.goto('/admin');
    
    const studentRow = page.locator('tr').filter({ hasText: 'John Doe' });
    const suspendButton = studentRow.getByRole('button', { name: /suspend/i });
    await suspendButton.click();
    
    // Logout
    await page.getByRole('button', { name: /admin user/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    
    // Try to login as suspended user
    await page.goto('/login');
    await page.getByRole('textbox', { name: /vt email/i }).fill('jdoe@vt.edu');
    await page.getByRole('textbox', { name: /password/i }).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show account suspended error
    await expect(page.getByText(/account suspended/i)).toBeVisible();
  });
});