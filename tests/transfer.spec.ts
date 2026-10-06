// spec: specs/gremlin-bank.md
// seed: seed.spec.ts

import { test, expect, env } from './fixtures';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage, type AccountName } from './pages/DashboardPage';
import { TransferPage } from './pages/TransferPage';
import { ReviewPage } from './pages/ReviewPage';

const huf = (n: number) => n.toLocaleString('en-US') + ' HUF';
const fee = (amount: number) => Math.min(6000, Math.max(200, Math.round(amount * 0.003)));

test.describe('Domestic transfer', () => {
  let transfer: TransferPage;
  let review: ReviewPage;

  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    transfer = new TransferPage(page);
    review = new ReviewPage(page);
    await login.goto();
    await login.signIn(env('GREMLIN_USER'), env('GREMLIN_PASSWORD'));
    await expect(new DashboardPage(page).heading).toBeVisible();
    await transfer.goto();
    await expect(transfer.heading).toBeVisible();
  });

  async function useKissPeter() {
    await transfer.useSavedPayee('Kiss Péter');
    await expect(transfer.ibanVerified).toBeVisible();
  }

  async function reviewTransfer(from: AccountName, amount: number) {
    await transfer.selectFromAccount(from);
    await useKissPeter();
    await transfer.enterAmount(amount);
    await transfer.submit();
    await expect(transfer.page).toHaveURL(/\/transfer\/review$/);
  }

  test('[high] Confirm transfer with correct PIN debits amount plus fee', async ({ page }) => {
    // 1. Fill Everyday Account, Kiss Péter (Use + Check IBAN), amount 5000, Continue
    await reviewTransfer('Everyday Account', 5000);
    await expect(review.detail('Amount')).toHaveText('5,000 HUF');
    await expect(review.detail('Fee')).toHaveText('200 HUF');
    await expect(review.detail('Total')).toHaveText('5,200 HUF');

    // 2. Enter the Transaction PIN and click 'Send money'
    await review.enterPin(env('GREMLIN_PIN'));
    await review.confirm();

    // 3. Approve the payment in the frame of the 'Payment approval' dialog
    await expect(review.confirmDialog).toBeVisible();
    await expect(review.approvalHeading).toHaveText('Approve this payment of 5,200 HUF');
    await review.approve();

    await expect(page).toHaveURL(/\/transfer\/done$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Money sent' })).toBeVisible();
    await expect(page.getByText(/^Reference: GB-[A-Z0-9]{6}$/)).toBeVisible();
    await expect(page.getByRole('term')).toHaveText(['Paid to', 'IBAN', 'Amount', 'Fee', 'Total', 'New balance, Everyday Account']);
    await expect(page.getByRole('definition')).toHaveText([
      'Kiss Péter',
      'HU72 9990 1017 1618 0339 8874 9892',
      '5,000 HUF',
      '200 HUF',
      '5,200 HUF',
      '1,244,800 HUF',
    ]);
  });

  test('[medium] Empty transfer form shows required-field messages', async ({ page }) => {
    // 1. Click 'Review transfer' with everything empty
    await transfer.submit();
    await expect(page).toHaveURL(/\/transfer$/);
    await expect(transfer.message('Enter a payee name.')).toBeVisible();
    await expect(transfer.message('Check the IBAN first.')).toBeVisible();
    await expect(transfer.message('Enter an amount greater than 0.')).toBeVisible();
  });

  test('[high] Invalid IBAN is rejected and blocks Continue', async ({ page }) => {
    // 2. Check an IBAN with a wrong check digit
    await transfer.beneficiaryName.fill('Kiss Péter');
    await transfer.enterIban('HU72 9990 1017 1618 0339 8874 9893');
    await expect(transfer.message('Invalid IBAN')).toBeVisible();

    // Enter amount 1000 and click Continue
    await transfer.enterAmount(1000);
    await transfer.submit();
    await expect(page).toHaveURL(/\/transfer$/);
    await expect(transfer.message('Check the IBAN first.')).toBeVisible();
  });

  test('[high] Zero amount is rejected', async ({ page }) => {
    // 1. With Kiss Péter verified, enter amount 0 and click 'Review transfer'
    await useKissPeter();
    await transfer.enterAmount(0);
    await transfer.submit();
    await expect(page).toHaveURL(/\/transfer$/);
    await expect(transfer.message('Enter an amount greater than 0.')).toBeVisible();
  });

  async function checkFeeRows(rows: { from: AccountName; amount: number; fee: number; total: number }[]) {
    for (const row of rows) {
      await test.step(`${row.from}, ${row.amount} -> fee ${row.fee} -> total ${row.total}`, async () => {
        await transfer.goto();
        await expect(transfer.heading).toBeVisible();
        await reviewTransfer(row.from, row.amount);
        expect(row.fee).toBe(fee(row.amount));
        await expect(review.detail('Amount')).toHaveText(huf(row.amount));
        await expect(review.detail('Fee')).toHaveText(huf(row.fee));
        await expect(review.detail('Total')).toHaveText(huf(row.total));
      });
    }
  }

  test('[high] Minimum fee of 200 HUF applies up to the threshold', async () => {
    // 1. Data-driven: for each row choose account, Kiss Péter, amount, Continue, read the review page
    await checkFeeRows([
      { from: 'Everyday Account', amount: 1, fee: 200, total: 201 },
      { from: 'Everyday Account', amount: 10000, fee: 200, total: 10200 },
      { from: 'Everyday Account', amount: 66000, fee: 200, total: 66200 },
    ]);
  });

  test('[high] Fee is 0.3% of the amount above the minimum', async () => {
    // 1. Data-driven: for each row choose account, Kiss Péter, amount, Continue, read the review page
    await checkFeeRows([
      { from: 'Everyday Account', amount: 67000, fee: 201, total: 67201 },
      { from: 'Everyday Account', amount: 100000, fee: 300, total: 100300 },
      { from: 'Everyday Account', amount: 1000000, fee: 3000, total: 1003000 },
    ]);
  });

  test('[high] Fee is capped at 6,000 HUF', async () => {
    // 1. Data-driven: for each row choose account, Kiss Péter, amount, Continue, read the review page
    await checkFeeRows([
      { from: 'Savings Account', amount: 1999000, fee: 5997, total: 2004997 },
      { from: 'Savings Account', amount: 2000000, fee: 6000, total: 2006000 },
    ]);
  });

  test('[high] Review step alone moves no money', async ({ page }) => {
    // 4. Reach the review page, then open /dashboard
    await reviewTransfer('Everyday Account', 5000);
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.loadingAccounts).toBeHidden();
    await expect(dashboard.account('Everyday Account').getByText('1,250,000 HUF')).toBeVisible();
  });
});
