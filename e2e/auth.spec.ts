import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should sign up new user', async ({ page }) => {
    await page.goto('/auth');
    
    await page.click('text=Sign up');
    await page.fill('input[type="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/feed/);
  });

  test('should sign in existing user', async ({ page }) => {
    await page.goto('/auth');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/feed/);
  });

  test('should handle forgot password', async ({ page }) => {
    await page.goto('/auth');
    
    await page.click('text=Forgot password?');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should sign out user', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    await page.click('[aria-label="Settings"]');
    await page.click('text=Sign out');
    
    await expect(page).toHaveURL('/auth');
  });
});
