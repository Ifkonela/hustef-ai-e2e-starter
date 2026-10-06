import type { Locator, Page } from '@playwright/test';

export type AccountName = 'Everyday Account' | 'Savings Account';

export class DashboardPage {
  readonly heading: Locator;
  readonly signedInAs: Locator;
  readonly signOutButton: Locator;
  readonly loadingAccounts: Locator;
  readonly exchangeRate: Locator;
  readonly sessionCode: Locator;
  readonly transactionRows: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Accounts' });
    this.signedInAs = page.getByText('Signed in as');
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    this.loadingAccounts = page.getByText('Loading accounts...');
    this.exchangeRate = page.getByText(/EUR\/HUF\s*\d{3}\.\d{2}/);
    this.sessionCode = page.getByText(/^Session code: GRM-[A-Z]+-[A-Z0-9]{4}$/);
    // Data rows only: the header row has no cells.
    this.transactionRows = page
      .getByRole('table', { name: 'Recent transactions' })
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  /** The account regions have no accessible name, so they are found by their heading. */
  account(name: AccountName): Locator {
    return this.page.getByRole('region').filter({ has: this.page.getByRole('heading', { name }) });
  }
}
