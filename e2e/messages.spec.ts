import { test, expect } from '@playwright/test';

test.describe('Messages Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.goto('/messages');
  });

  test('should start new conversation', async ({ page }) => {
    await page.click('[aria-label="New conversation"]');
    await page.fill('input[placeholder*="Search"]', 'John');
    await page.click('text=John Doe').first();
    await page.click('button:has-text("Start chat")');
    
    await expect(page.locator('text=John Doe')).toBeVisible();
  });

  test('should send text message', async ({ page }) => {
    await page.click('[data-conversation]').first();
    await page.fill('textarea[placeholder*="Type a message"]', 'Hello!');
    await page.click('[aria-label="Send message"]');
    
    await expect(page.locator('text=Hello!')).toBeVisible();
  });

  test('should send emoji', async ({ page }) => {
    await page.click('[data-conversation]').first();
    await page.click('[aria-label="Emoji"]');
    await page.click('[data-emoji="👍"]');
    await page.click('[aria-label="Send message"]');
    
    await expect(page.locator('text=👍')).toBeVisible();
  });

  test('should delete message', async ({ page }) => {
    await page.click('[data-conversation]').first();
    await page.click('[data-message]').first().click({ button: 'right' });
    await page.click('text=Delete');
    await page.click('text=Confirm');
    
    await expect(page.locator('text=Message deleted')).toBeVisible();
  });
});
