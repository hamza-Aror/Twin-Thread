import { expect, test } from '@playwright/test';

test.describe('ClimateTwin demo walkthrough', () => {
  test('dashboard, outlook, safe window, simulator, map and Urdu', async ({ page }) => {
    await page.goto('/?demo=1#/overview');
    await expect(page.getByText('Demo data (synthetic)').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Current conditions' })).toBeVisible();
    await expect(page.getByText(/Demo mode: synthetic values/)).toBeVisible();

    await page.getByRole('link', { name: 'Hourly outlook' }).first().click();
    await expect(page.getByRole('heading', { name: 'Hourly heat outlook' })).toBeVisible();

    await page.getByRole('link', { name: 'Safe window finder' }).first().click();
    await expect(page.getByText('Most favourable window')).toBeVisible();

    await page.getByRole('link', { name: 'What-if simulator' }).first().click();
    await page.getByRole('button', { name: '2 °C hotter' }).click();
    await expect(page.getByText(/Heat index changes by \u2066?\+/)).toBeVisible();

    await page.getByRole('link', { name: 'Resource map' }).first().click();
    await page.getByRole('button', { name: /Sample water point A/ }).click();
    await expect(page.getByText('Sample entry, not a real facility').first()).toBeVisible();

    await page.getByRole('button', { name: 'اردو' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('live API failure is reported honestly, not replaced with demo data', async ({ page }) => {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    await page.goto('/#/overview');
    await expect(page.getByText('Live weather could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with labelled demo data' })).toBeVisible();
  });
});
