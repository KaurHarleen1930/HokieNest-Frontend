import { test, expect } from '@playwright/test';

test.describe('Properties Pages', () => {
  test('displays property listings on properties page', async ({ page }) => {
    await page.goto('/properties');
    
    // Wait for properties to load
    await expect(page.getByTestId('listing-card')).toHaveCount(12); // From seed data
    
    // Check that property information is displayed
    await expect(page.getByText('Modern 2BR Apartment Near VT Campus')).toBeVisible();
    await expect(page.getByTestId('price').first()).toContainText('$');
  });

  test('can filter properties by price range', async ({ page }) => {
    await page.goto('/properties');
    
    // Wait for initial load
    await expect(page.getByTestId('listing-card')).toHaveCount(12);
    
    // Open filters
    await page.getByRole('button', { name: /filters/i }).click();
    
    // Set price filter
    await page.getByLabel('Min').fill('1500');
    
    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();
    
    // Should show fewer properties
    await expect(page.getByTestId('listing-card').first()).toBeVisible();
    
    // All visible prices should be >= $1500
    const priceElements = await page.getByTestId('price').all();
    for (const priceElement of priceElements) {
      const priceText = await priceElement.textContent();
      const price = parseInt(priceText?.replace(/[$,\/mo]/g, '') || '0');
      expect(price).toBeGreaterThanOrEqual(1500);
    }
  });

  test('can filter by international friendly', async ({ page }) => {
    await page.goto('/properties');
    
    // Open filters
    await page.getByRole('button', { name: /filters/i }).click();
    
    // Check international friendly
    await page.getByLabel('International Student Friendly').check();
    
    // Apply filters
    await page.getByRole('button', { name: /apply filters/i }).click();
    
    // All visible properties should have international friendly badge
    const cards = await page.getByTestId('listing-card').all();
    for (const card of cards) {
      await expect(card.getByText('Intl Friendly')).toBeVisible();
    }
  });

  test('can navigate to property detail page', async ({ page }) => {
    await page.goto('/properties');
    
    // Wait for properties to load
    await expect(page.getByTestId('listing-card').first()).toBeVisible();
    
    // Click on first property's "View Details" button
    await page.getByTestId('view-details').first().click();
    
    // Should navigate to property detail page
    await expect(page.url()).toMatch(/\/properties\/[a-zA-Z0-9]+/);
    
    // Should show property title
    await expect(page.getByTestId('listing-title')).toBeVisible();
  });

  test('shows property detail information correctly', async ({ page }) => {
    await page.goto('/properties');
    
    // Navigate to first property
    await page.getByTestId('view-details').first().click();
    
    // Wait for detail page to load
    await expect(page.getByTestId('listing-title')).toBeVisible();
    
    // Check that key information is displayed
    await expect(page.getByText(/\$[\d,]+\/mo/)).toBeVisible(); // Price
    await expect(page.getByText(/bed/)).toBeVisible(); // Beds
    await expect(page.getByText(/bath/)).toBeVisible(); // Baths
    await expect(page.getByText(/Blacksburg, VA/)).toBeVisible(); // Address
  });

  test('shows empty state when no properties match filters', async ({ page }) => {
    await page.goto('/properties');
    
    // Open filters and set impossible price range
    await page.getByRole('button', { name: /filters/i }).click();
    await page.getByLabel('Min').fill('10000');
    await page.getByRole('button', { name: /apply filters/i }).click();
    
    // Should show empty state
    await expect(page.getByText('No properties found')).toBeVisible();
    await expect(page.getByText('Try adjusting your filters')).toBeVisible();
  });

  test('can clear all filters', async ({ page }) => {
    await page.goto('/properties');
    
    const initialCount = await page.getByTestId('listing-card').count();
    
    // Apply some filters
    await page.getByRole('button', { name: /filters/i }).click();
    await page.getByLabel('Min').fill('2000');
    await page.getByRole('button', { name: /apply filters/i }).click();
    
    // Should have fewer properties
    const filteredCount = await page.getByTestId('listing-card').count();
    expect(filteredCount).toBeLessThan(initialCount);
    
    // Clear filters
    await page.getByRole('button', { name: /clear all/i }).click();
    
    // Should return to original count
    await expect(page.getByTestId('listing-card')).toHaveCount(initialCount);
  });
});