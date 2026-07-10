import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { loginAsAdmin } from '../helpers/auth';

/**
 * Browser tests navigate via click-based UI interaction.
 * The Vite dev server starts at the landing page.
 * Use expect.element() for locator assertions with retry-ability.
 */

describe('auth', () => {
  it('renders the landing page with Try the Demo button', async () => {
    await expect.element(page.getByRole('button', { name: /try the demo/i })).toBeVisible();
  });

  it('navigates to login page by clicking Try the Demo', async () => {
    await page.getByRole('button', { name: /try the demo/i }).click();
    await new Promise((r) => setTimeout(r, 3000));

    await expect.element(page.getByLabelText('Email')).toBeVisible();
    await expect.element(page.getByLabelText('Password')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  it('shows error for invalid credentials', async () => {
    await page.getByRole('button', { name: /try the demo/i }).click();
    await new Promise((r) => setTimeout(r, 3000));

    await page.getByLabelText('Email').fill('wrong@wrong.com');
    await page.getByLabelText('Password').fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();
    await new Promise((r) => setTimeout(r, 3000));

    // Should still see login form (not redirected away)
    await expect.element(page.getByLabelText('Email')).toBeVisible();
  });

  it('logs in as admin and sees dashboard', async () => {
    await page.getByRole('button', { name: /try the demo/i }).click();
    await new Promise((r) => setTimeout(r, 3000));

    await loginAsAdmin();

    await expect.element(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
  });
});