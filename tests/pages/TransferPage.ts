import type { Locator, Page } from '@playwright/test';
import type { AccountName } from './DashboardPage';

export class TransferPage {
  readonly heading: Locator;
  readonly fromAccount: Locator;
  readonly beneficiaryName: Locator;
  readonly iban: Locator;
  readonly checkIbanButton: Locator;
  readonly ibanVerified: Locator;
  readonly amount: Locator;
  readonly continueButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'New transfer' });
    this.fromAccount = page.getByRole('combobox', { name: 'From account' });
    this.beneficiaryName = page.getByRole('textbox', { name: 'Beneficiary name' });
    this.iban = page.getByRole('textbox', { name: 'IBAN' });
    this.checkIbanButton = page.getByRole('button', { name: 'Check IBAN' });
    this.ibanVerified = page.getByText(/IBAN verified: GRM-SHADOW-[A-Z0-9]{4}/);
    this.amount = page.getByRole('textbox', { name: 'Amount (HUF)' });
    this.continueButton = page.getByRole('button', { name: 'Continue' });
  }

  async goto() {
    await this.page.goto('/transfer');
  }

  /** A validation or status message on the form, by its exact text. */
  message(text: string): Locator {
    return this.page.getByText(text);
  }

  async selectFromAccount(name: AccountName) {
    await this.fromAccount.selectOption({ label: name });
  }

  /** Clicks 'Use' for a saved payee, then 'Check IBAN'. */
  async useSavedPayee(name: string) {
    await this.page.getByRole('button', { name: `Use ${name}` }).click();
    await this.checkIbanButton.click();
  }

  async enterIban(iban: string) {
    await this.iban.fill(iban);
    await this.checkIbanButton.click();
  }

  async enterAmount(amount: number | string) {
    await this.amount.fill(String(amount));
  }

  async submit() {
    await this.continueButton.click();
  }
}
