import { expect, test } from '@playwright/test';

/**
 * End-to-end checks. The first two use demo data or blocked requests, so they never depend on
 * the weather service. The search test answers Open-Meteo's geocoding and forecast requests
 * with fixed responses in the documented format, so it runs offline and is repeatable.
 */

test.describe('CoolRoute walkthrough', () => {
  test('dashboard, theme, pages and Urdu (demo data)', async ({ page }) => {
    await page.goto('/?demo=1#/dashboard');
    await expect(page).toHaveTitle('CoolRoute');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByText('Demo data (synthetic)').first()).toBeVisible();
    await expect(page.getByText('Heat risk now')).toBeVisible();
    await expect(page.getByText('Water and cooling nearby')).toBeVisible();

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('link', { name: 'Hourly outlook' }).first().click();
    await expect(page.getByRole('heading', { name: 'Hourly heat outlook' })).toBeVisible();

    await page.getByRole('link', { name: 'What-if simulator' }).first().click();
    await page.getByRole('button', { name: '2 °C hotter' }).click();
    await expect(page.getByText(/Heat index changes by/)).toBeVisible();

    await page.getByRole('link', { name: 'Resource map' }).first().click();
    await page.getByRole('button', { name: /Demo water point A/ }).first().click();
    await expect(page.getByText(/Demo entry for testing the app offline/).first()).toBeVisible();

    await page.getByLabel('Language').first().selectOption('ur');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('live API failure is reported honestly, not replaced with demo data', async ({ page }) => {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    await page.goto('/#/dashboard');
    await expect(page.getByText('Live weather could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with labelled demo data' })).toBeVisible();
  });

  test('city search updates weather for the chosen city', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000);
    const h0 = now - (now % 3600) - 3 * 3600;
    const time = Array.from({ length: 48 }, (_, i) => h0 + i * 3600);
    const forecast = (temp: number) => ({
      timezone: 'Asia/Karachi',
      utc_offset_seconds: 18000,
      current: { time: now, temperature_2m: temp, relative_humidity_2m: 40, apparent_temperature: temp, wind_speed_10m: 10, weather_code: 0, is_day: 1 },
      hourly: { time, temperature_2m: time.map(() => temp), relative_humidity_2m: time.map(() => 40) },
      daily: { time: [h0], temperature_2m_max: [temp + 3], temperature_2m_min: [temp - 6] },
    });
    await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
      route.fulfill({
        json: {
          results: [
            { id: 1269843, name: 'Hyderabad', latitude: 17.3841, longitude: 78.4564, country: 'India', country_code: 'IN', admin1: 'Telangana' },
            { id: 1176734, name: 'Hyderabad', latitude: 25.3924, longitude: 68.3737, country: 'Pakistan', country_code: 'PK', admin1: 'Sindh' },
          ],
        },
      }),
    );
    await page.route('**/api.open-meteo.com/v1/forecast**', (route) => {
      const lat = Number(new URL(route.request().url()).searchParams.get('latitude'));
      return route.fulfill({ json: forecast(lat > 25 && lat < 26 ? 38.2 : 31.0) });
    });
    await page.goto('/#/dashboard');
    const search = page.getByRole('combobox', { name: 'Search for a city' }).first();
    await search.click();
    await search.fill('Hyder');
    await page.getByRole('option', { name: /Sindh, Pakistan/ }).click();
    await expect(page.locator('#page-title')).toHaveText('Hyderabad');
    await expect(page.getByText('38.2 °C').first()).toBeVisible();
    await expect(page.getByText(/No published city or provincial heatwave criteria are integrated for Hyderabad/)).toBeVisible();
  });

  test('map places come from OpenStreetMap and are classified conservatively', async ({ page }) => {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    await page.route('**/overpass-api.de/**', (route) =>
      route.fulfill({
        json: {
          elements: [
            { type: 'node', id: 1, lat: 24.862, lon: 67.002, tags: { amenity: 'drinking_water', name: 'Sabeel water point' } },
            { type: 'node', id: 2, lat: 24.863, lon: 67.003, tags: { amenity: 'drinking_water', drinking_water: 'no', name: 'Broken tap' } },
            { type: 'node', id: 3, lat: 24.865, lon: 67.006, tags: { tourism: 'hotel', name: 'Hotel Example' } },
          ],
        },
      }),
    );
    await page.goto('/#/map');
    await expect(page.getByText('Sabeel water point').first()).toBeVisible();
    await expect(page.getByText('Broken tap')).toHaveCount(0);
    await page.getByRole('button', { name: /Hotel Example/ }).first().click();
    await expect(page.getByText(/It is not a public cooling centre/).first()).toBeVisible();
  });
});
