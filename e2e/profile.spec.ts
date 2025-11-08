import { test, expect } from '@playwright/test';

test.describe('Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.goto('/profile');
  });

  test('should update profile information', async ({ page }) => {
    await page.click('[aria-label="Edit profile"]');
    await page.fill('input[name="display_name"]', 'Updated Name');
    await page.fill('textarea[name="bio"]', 'Updated bio');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=Profile updated')).toBeVisible();
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should upload profile picture', async ({ page }) => {
    await page.click('[aria-label="Edit profile"]');
    await page.setInputFiles('input[type="file"]', 'test-assets/avatar.png');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=Profile updated')).toBeVisible();
  });

  test('should view own posts', async ({ page }) => {
    await page.click('text=Posts');
    
    await expect(page.locator('[data-post]')).toHaveCount(1, { timeout: 5000 });
  });

  test('should follow another user', async ({ page }) => {
    await page.goto('/profile/another-user');
    await page.click('button:has-text("Follow")');
    
    await expect(page.locator('button:has-text("Following")')).toBeVisible();
  });
});
