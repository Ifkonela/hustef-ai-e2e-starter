// spec: specs/gremlin-bank.md
// seed: seed.spec.ts

import { test, expect, env } from './fixtures';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Dashboard', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    dashboard = new DashboardPage(page);
    await login.goto();
    await login.signIn(env('GREMLIN_USER'), env('GREMLIN_PASSWORD'));
    await expect(dashboard.heading).toBeVisible();
  });

  test('[medium] Dashboard shows both accounts with IBAN and balance', async () => {
    // 1. After the seed, wait until the 'Loading accounts...' status disappears
    await expect(dashboard.loadingAccounts).toBeHidden();
    const everyday = dashboard.account('Everyday Account');
    const savings = dashboard.account('Savings Account');
    await expect(everyday).toBeVisible();
    await expect(savings).toBeVisible();

    // 2. Read IBAN and Balance of each
    await expect(everyday.getByText('HU39 9992 0265 3141 5926 5358 9797')).toBeVisible();
    await expect(everyday.getByText('1,250,000 HUF')).toBeVisible();
    await expect(savings.getByText('HU03 9992 0265 2718 2818 2845 9043')).toBeVisible();
    await expect(savings.getByText('5,400,000 HUF')).toBeVisible();

    // 3. Read the exchange rate and the session code (format only, never the exact value)
    await expect(dashboard.exchangeRate).toBeVisible();
    await expect(dashboard.sessionCode).toBeVisible();
  });

  test('[medium] Recent transactions lists the five seeded rows newest first', async () => {
    // 1. Read the table 'Recent transactions' (columns Date, Description, Amount)
    await expect(dashboard.transactionRows).toHaveCount(5);
    await expect(dashboard.transactionRows).toHaveText([
      /2026-09-30\s*Grocery store, Budapest\s*-18,450 HUF/,
      /2026-09-29\s*Salary, Gremlin Works Ltd\.\s*\+685,000 HUF/,
      /2026-09-27\s*Mobile phone bill\s*-7,990 HUF/,
      /2026-09-25\s*Card payment, bookshop\s*-12,300 HUF/,
      /2026-09-24\s*Transfer from Savings Account\s*\+50,000 HUF/,
    ]);
  });
});
