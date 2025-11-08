import { test, expect } from '@playwright/test';

test.describe('Feed Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/feed/);
  });

  test('should create a text post', async ({ page }) => {
    await page.click('[aria-label="Create post"]');
    await page.fill('textarea[placeholder*="What\'s on your mind"]', 'Test post content');
    await page.click('button:has-text("Post")');
    
    await expect(page.locator('text=Test post content')).toBeVisible();
  });

  test('should like a post', async ({ page }) => {
    const likeButton = page.locator('[aria-label="Like"]').first();
    await likeButton.click();
    
    await expect(likeButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should comment on a post', async ({ page }) => {
    await page.click('[aria-label="Comment"]').first();
    await page.fill('textarea[placeholder*="Write a comment"]', 'Test comment');
    await page.click('button:has-text("Comment")');
    
    await expect(page.locator('text=Test comment')).toBeVisible();
  });

  test('should share a post', async ({ page }) => {
    await page.click('[aria-label="Share"]').first();
    await page.click('text=Copy link');
    
    await expect(page.locator('text=Link copied')).toBeVisible();
  });

  test('should filter feed by trending', async ({ page }) => {
    await page.click('text=Trending');
    
    await expect(page).toHaveURL(/\/trending/);
  });
});
