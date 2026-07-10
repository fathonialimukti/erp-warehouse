import { page } from 'vitest/browser';

/**
 * Log in via the browser UI using the seeded admin account.
 * Assumes we're already on the login page (/login).
 */
export async function loginAsAdmin(): Promise<void> {
  await page.getByLabelText('Email').fill('admin@mail.com');
  await page.getByLabelText('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await new Promise((r) => setTimeout(r, 4000));
}