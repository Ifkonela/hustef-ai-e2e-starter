// spec: specs/gremlin-bank.md
// seed: seed.spec.ts

import { test, expect, env } from './fixtures';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Sign in and sign out', () => {
  test('[high] Sign in with valid credentials', async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    // 1. Open /login
    await login.goto();
    await expect(login.heading).toBeVisible();
    await expect(login.username).toBeVisible();
    await expect(login.password).toBeVisible();
    await expect(login.signInButton).toBeVisible();

    // 2. Fill Username with GREMLIN_USER and Password with GREMLIN_PASSWORD, click 'Sign in'
    await login.signIn(env('GREMLIN_USER'), env('GREMLIN_PASSWORD'));

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.signedInAs).toContainText(env('GREMLIN_USER'));
    await expect(dashboard.signOutButton).toBeVisible();
  });

  test('[high] Sign in rejected for a wrong password', async ({ page }) => {
    const login = new LoginPage(page);

    // 1. On /login fill GREMLIN_USER with a wrong password, click 'Sign in'
    await login.goto();
    await login.signIn(env('GREMLIN_USER'), 'not-the-password');

    await expect(page).toHaveURL(/\/login$/);
    await expect(login.alert.filter({ hasText: 'Wrong username or password.' })).toBeVisible();
  });
});
