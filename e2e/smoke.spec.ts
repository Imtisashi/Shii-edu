import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Shii-Edu')).toBeVisible();
    await expect(page.locator('text=Login')).toBeVisible();
  });

  test('roles page loads', async ({ page }) => {
    await page.goto('/roles');
    await expect(page.locator('text=Institute')).toBeVisible();
    await expect(page.locator('text=Parents')).toBeVisible();
    await expect(page.locator('text=Driver')).toBeVisible();
  });

  test('institute auth page loads', async ({ page }) => {
    await page.goto('/auth/institute');
    await expect(page.locator('text=Institute Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('parents auth page loads', async ({ page }) => {
    await page.goto('/auth/parents');
    await expect(page.locator('text=Parents Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('driver auth page loads', async ({ page }) => {
    await page.goto('/auth/driver');
    await expect(page.locator('text=Driver Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('legal pages load', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=Privacy Policy')).toBeVisible();

    await page.goto('/terms');
    await expect(page.locator('text=Terms of Service')).toBeVisible();
  });
});