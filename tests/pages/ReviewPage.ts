import type { FrameLocator, Locator, Page } from '@playwright/test';

export type DetailLabel = 'Amount' | 'Fee' | 'Total';

export class ReviewPage {
  readonly details: Locator;
  readonly pin: Locator;
  readonly confirmButton: Locator;
  readonly confirmDialog: Locator;
  readonly secureFrame: FrameLocator;
  readonly approvalHeading: Locator;
  readonly approveButton: Locator;

  constructor(readonly page: Page) {
    this.details = page.getByRole('table', { name: 'Transfer details' });
    // Custom element with a closed shadow DOM, not in the accessibility tree: the test id is the only handle.
    this.pin = page.getByTestId('secure-pin');
    this.confirmButton = page.getByRole('button', { name: 'Send money' });
    this.confirmDialog = page.getByRole('dialog', { name: 'Payment approval' });
    // The iframe has no title in release 2, so it is found inside the approval dialog.
    this.secureFrame = this.confirmDialog.locator('iframe').contentFrame();
    this.approvalHeading = this.secureFrame.getByRole('heading', { name: /^Approve this payment of/ });
    this.approveButton = this.secureFrame.getByRole('button', { name: 'Approve', exact: true });
  }

  /** The value cell of a row in the 'Transfer details' table. */
  detail(label: DetailLabel): Locator {
    return this.details
      .getByRole('row')
      .filter({ has: this.page.getByRole('rowheader', { name: label, exact: true }) })
      .getByRole('cell');
  }

  /** The PIN input sits in a closed shadow root, so it is focused and typed with the keyboard. */
  async enterPin(pin: string) {
    await this.pin.click();
    await this.page.keyboard.type(pin);
  }

  async confirm() {
    await this.confirmButton.click();
  }

  async approve() {
    await this.approveButton.click();
  }
}
