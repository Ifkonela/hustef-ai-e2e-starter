# Gremlin Bank - Sign in, Dashboard and Domestic Transfer

## Application Overview

Test plan for Gremlin Bank (fictional demo bank, Release 1 observed at https://gremlin.shiwa.io). Covers sign in/out, the dashboard, a domestic HUF transfer (form, fees, limits, review, PIN confirmation), mobile/responsive layout and cross-browser compatibility. Explored through the browser only.

Conventions
- Credentials come from the environment, never literals: GREMLIN_USER, GREMLIN_PASSWORD, GREMLIN_PIN (transaction PIN, 4 digits), and the TOTP secret from .env (no TOTP step was seen on sign-in in Release 1; see open questions).
- Every browser context starts with a fresh bank state (state lives in a cookie), so scenarios are independent. Unless stated otherwise, scenarios start from the seed (signed in as GREMLIN_USER on /dashboard).
- Risk tags in every scenario title: [high] = money movement, money amounts or security; [medium] = information shown to the user or input handling without money movement; [low] = cosmetic or secondary information. Every scenario that moves money, or computes/limits the amount that moves, is [high].
- Rule provenance: [RULE] = business rule given to the testers, used as the test oracle. [APP] = rule or message stated by the app. [OBSERVED] = seen during exploration only, not an oracle; to be confirmed by a human.
- Random or generated values (tip of the day, EUR/HUF rate, codes like GRM-XXXX-XXXX, GRM-SHADOW, GRM-CHART, session code, transfer reference) are checked for format/presence only, never for exact value.
- Initial data (fresh state): Everyday Account HU39 9992 0265 3141 5926 5358 9797, balance 1,250,000 HUF. Savings Account HU03 9992 0265 2718 2818 2845 9043, balance 5,400,000 HUF. Saved payees: Kiss Péter HU72 9990 1017 1618 0339 8874 9892, Nagy Eszter HU71 9990 2025 1414 2135 6237 3099, Tóth Bence HU03 9990 3033 1732 0508 0756 8879.

Business rules (test oracles)
- [RULE] Fee = 0.3% of the amount, minimum 200 HUF, maximum 6,000 HUF. Total debited = amount + fee.
  - The minimum applies up to 66,666 HUF (0.3% of 66,667 is 200.001). The maximum is reached at exactly 2,000,000 HUF. Because the daily limit is also 2,000,000 HUF, no accepted single transfer can exceed the cap; the cap is tested at its boundary (2,000,000 -> 6,000) and just below it.
  - The rule does not state a rounding method, so the fee examples below use amounts whose 0.3% is a whole number (or that fall under the minimum). Rounding is an open question.
- [RULE]/[APP] Limits: up to 10,000,000 HUF per transfer and 2,000,000 HUF per day. Amounts must be greater than 0 (smallest valid amount 1 HUF).
- [RULE] A transfer is refused when amount + fee exceeds the available balance of the From account.
- Expected values in this plan are computed from these rules, not copied from the page.

Required negative cases and where they are covered
- Wrong password: 1.2. Empty beneficiary: 3.1. Invalid IBAN: 3.2. Zero amount: 3.3. Wrong PIN: 3.9. Insufficient funds: 3.5.

Confirmation flow (from the second planner run): review -> Transaction PIN (GREMLIN_PIN) -> 'Confirm transfer' -> 'Confirm payment' dialog with iframe 'Gremlin Secure' -> 'Approve payment' (or 'Cancel') -> /transfer/done. Covered by 3.10 and 3.11; 3.7 builds on it. Section 4 (responsive, cross-browser) was not explored and was added by the testers.

## Test Scenarios

### 1. Sign in and sign out

**Seed:** `seed.spec.ts`

#### 1.1. [high] Sign in with valid credentials

**File:** `tests/auth/sign-in.spec.ts`

**Steps:**
  1. Without the seed sign-in (fresh context), open /login.
    - expect: Heading 'Sign in to Gremlin Bank', fields Username and Password, button 'Sign in' are visible
    - expect: Note 'Use the demo users from the workshop materials. Never use real credentials here.' is visible
  2. Fill Username with GREMLIN_USER and Password with GREMLIN_PASSWORD, click 'Sign in'
    - expect: URL is /dashboard
    - expect: Heading 'Accounts' level 1 is visible
    - expect: Header shows 'Signed in as' followed by the user name and a 'Sign out' button
    - expect: Footer shows 'Release 1' (or the release from GREMLIN_RELEASE)
    - expect: In Release 1 no TOTP step appears [OBSERVED]; if a release adds one, fill it using the TOTP secret from .env

#### 1.2. [high] Sign in rejected for empty or wrong credentials

**File:** `tests/auth/sign-in-negative.spec.ts`

**Steps:**
  1. On /login fill GREMLIN_USER with a wrong password (the literal text 'not-the-password'), click 'Sign in'
    - expect: URL stays /login
    - expect: Alert text 'Wrong username or password.'
    - expect: The message does not say whether the user or the password was wrong
    - expect: The password is not shown anywhere on the page
  2. Clear both fields and click 'Sign in'
    - expect: URL stays /login and an error is shown ('Wrong username or password.' [OBSERVED]; no per-field message, see open questions)
  3. Fill an unknown username and any password, submit (no more than 3 failed attempts in this scenario, to stay below the lockout in 1.3)
    - expect: URL stays /login, the same generic message 'Wrong username or password.'

#### 1.3. [high] Sign in lockout after repeated failed attempts

**File:** `tests/auth/lockout.spec.ts`

**Steps:**
  1. On /login submit wrong credentials 5 times in a row
    - expect: Attempts 1 to 4 show 'Wrong username or password.'
    - expect: Attempt 5 shows 'Too many attempts. Wait 60 seconds.' [APP message; 5 attempts is OBSERVED]
  2. Immediately sign in with GREMLIN_USER/GREMLIN_PASSWORD
    - expect: URL stays /login and 'Too many attempts. Wait 60 seconds.' is shown (valid credentials do not bypass an active lockout; not yet observed)
  3. After 60 seconds sign in with valid credentials (use test.setTimeout above 60 s and wait for the message to disappear or for the countdown, not a fixed sleep)
    - expect: URL is /dashboard
    - expect: Run this scenario serially (test.describe.configure({ mode: 'serial' }) or a separate project), because the lockout may be shared across parallel workers

#### 1.4. [high] Sign out and protected routes

**File:** `tests/auth/sign-out.spec.ts`

**Steps:**
  1. From the seeded dashboard click 'Sign out'
    - expect: URL is /login, title 'Sign in - Gremlin Bank'
  2. Press browser Back
    - expect: URL is /login, heading 'Accounts' is not visible
  3. Navigate directly to /dashboard, /transfer, /transfer/review, /transfer/done and /
    - expect: Every URL ends on /login

### 2. Dashboard

**Seed:** `seed.spec.ts`

#### 2.1. [medium] Dashboard shows both accounts and format-only widgets

**File:** `tests/dashboard/accounts.spec.ts`

**Steps:**
  1. After the seed, wait until the 'Loading accounts...' status disappears
    - expect: Two regions appear: 'Everyday Account' and 'Savings Account'
  2. Read IBAN and Balance of each
    - expect: Everyday Account: IBAN HU39 9992 0265 3141 5926 5358 9797, balance 1,250,000 HUF
    - expect: Savings Account: IBAN HU03 9992 0265 2718 2818 2845 9043, balance 5,400,000 HUF
  3. Read 'Tip of the day', 'Exchange rate' and the generated codes (format only, never the exact value)
    - expect: Tip of the day is a non-empty text
    - expect: Exchange rate shows 'EUR/HUF' followed by a number matching /^\d{3}\.\d{2}$/ and the note 'Indicative rate. Updated on every page load.'
    - expect: Session code matches /^GRM-[A-Z]+-[A-Z0-9]{4}$/
    - expect: The 'Security check passed' image has an accessible name matching /Code GRM-ARIA-[A-Z0-9]{4}/
  4. Click 'New transfer'
    - expect: URL is /transfer, heading 'New transfer'

#### 2.2. [medium] Recent transactions table

**File:** `tests/dashboard/transactions.spec.ts`

**Steps:**
  1. Read the table 'Recent transactions' (columns Date, Description, Amount)
    - expect: Exactly 5 rows, newest first, with these values (fixed demo data):
    - expect: 2026-09-30 | Grocery store, Budapest | -18,450 HUF
    - expect: 2026-09-29 | Salary, Gremlin Works Ltd. | +685,000 HUF
    - expect: 2026-09-27 | Mobile phone bill | -7,990 HUF
    - expect: 2026-09-25 | Card payment, bookshop | -12,300 HUF
    - expect: 2026-09-24 | Transfer from Savings Account | +50,000 HUF

#### 2.3. [low] Spending chart data (last 30 days)

**File:** `tests/dashboard/chart-data.spec.ts`

**Steps:**
  1. Locate 'Spending in the last 30 days' and click 'Show chart data'
    - expect: Button text changes to 'Hide chart data'
    - expect: A data table appears with caption matching /^Spending in the last 30 days \(GRM-CHART-[A-Z0-9]{4}\)$/
    - expect: Columns Date and Amount; 30 rows of consecutive days, the last row is today's date (the window is relative to today)
    - expect: Every amount matches /^\d{1,3}(,\d{3})* HUF$/ (non-negative HUF with thousands separators)
  2. Click 'Hide chart data'
    - expect: Button text is 'Show chart data' and the data table is hidden

### 3. Domestic transfer

**Seed:** `seed.spec.ts`

#### 3.1. [medium] Transfer form validation (empty beneficiary) and free-text handling

**File:** `tests/transfer/form-validation.spec.ts`

**Steps:**
  1. Open /transfer and click 'Continue' with everything empty
    - expect: URL stays /transfer
    - expect: Messages: 'Enter a beneficiary name.', 'Check the IBAN first.', 'Enter an amount greater than 0.'
    - expect: No message for Reference (optional)
    - expect: From account defaults to 'Everyday Account' and shows 'Available: 1,250,000 HUF'
  2. Leave Beneficiary name empty, enter IBAN HU72 9990 1017 1618 0339 8874 9892 and click 'Check IBAN', enter amount 1000, click 'Continue'
    - expect: URL stays /transfer and 'Enter a beneficiary name.' is shown
  3. Enter a name of only spaces and click 'Continue'
    - expect: URL stays /transfer and 'Enter a beneficiary name.' is shown
  4. Enter 'Kiss Péter' and click 'Continue'
    - expect: URL is /transfer/review
  5. On a fresh /transfer, switch From account to 'Savings Account'
    - expect: 'Available: 5,400,000 HUF'
  6. Enter 200 'A' characters as Beneficiary name and 300 'R' as Reference, a verified IBAN and amount 1000, click 'Continue'
    - expect: URL /transfer/review; the To cell starts with 'AAAA' and Fee is 200 HUF, Total 1,200 HUF (length handling: see open questions)
  7. Enter Beneficiary name '<b>x</b>' and Reference '<script>1</script>', continue
    - expect: The To cell shows the literal text '<b>x</b>' (HTML escaped, no bold element) and no dialog or script runs
  8. Enter 'Tóth Bence' as name and continue
    - expect: The To cell shows 'Tóth Bence' with the accent preserved

#### 3.2. [high] IBAN check and saved payees

**File:** `tests/transfer/iban-check.spec.ts`

**Steps:**
  1. Check these IBANs with 'Check IBAN': 'HU72 9990 1017 1618 0339 8874 9892', 'hu72999010171618033988749892', 'HU72 9990 1017 1618 0339 8874 9892 ' (trailing space)
    - expect: Each shows a status matching /^IBAN verified: GRM-SHADOW-[A-Z0-9]{4}$/ (code is generated, format only)
  2. Check these invalid IBANs: 'HU72 9990 1017 1618 0339 8874 9893' (wrong check digit), 'HU00 1234' (too short), empty field
    - expect: Each shows 'Invalid IBAN'
    - expect: Clicking 'Continue' with name 'Kiss Péter' and amount 1000 stays on /transfer with 'Check the IBAN first.'
  3. Verify a valid IBAN, then change one digit without re-checking, click 'Continue'
    - expect: URL stays /transfer and 'Check the IBAN first.' is shown (editing invalidates the check)
  4. Click 'Use' for Kiss Péter, Nagy Eszter and Tóth Bence in turn, then 'Check IBAN'
    - expect: Beneficiary name and IBAN are filled with that payee's values (see initial data)
    - expect: Each IBAN is verified (status matches /^IBAN verified: GRM-SHADOW-[A-Z0-9]{4}$/)

#### 3.3. [high] Amount parsing and invalid amounts (zero amount)

**File:** `tests/transfer/amount-validation.spec.ts`

**Steps:**
  1. With Kiss Péter verified, enter amount 0 and click 'Continue'
    - expect: URL stays /transfer and 'Enter an amount greater than 0.' is shown
  2. Repeat with -5, abc, 1.5, 5000.50 and empty
    - expect: Each stays on /transfer with 'Enter an amount greater than 0.' (HUF transfers are whole forints; message wording for decimals and text is an open question)
  3. Enter amount 1 and click 'Continue'
    - expect: Review shows Amount 1 HUF, Fee 200 HUF (minimum fee), Total 201 HUF
  4. Enter '1,000' and '1 000' in turn
    - expect: Review shows Amount 1,000 HUF, Fee 200 HUF, Total 1,200 HUF [OBSERVED that separators are accepted; to be confirmed]

#### 3.4. [high] Fee calculation (0.3%, min 200, max 6,000 HUF)

**File:** `tests/transfer/fees.spec.ts`

**Steps:**
  1. Data-driven: for each row, choose the From account, use Kiss Péter (verified), enter the amount, click 'Continue' and read the review page. Expected fee = min(6,000, max(200, 0.3% x amount)); total = amount + fee [RULE]
    - expect: Everyday, 1 -> fee 200 -> total 201 (minimum)
    - expect: Everyday, 10,000 -> fee 200 -> total 10,200 (0.3% = 30, minimum applies)
    - expect: Everyday, 66,000 -> fee 200 -> total 66,200 (0.3% = 198, just below the minimum threshold)
    - expect: Everyday, 67,000 -> fee 201 -> total 67,201 (0.3% = 201, just above the minimum threshold)
    - expect: Everyday, 100,000 -> fee 300 -> total 100,300
    - expect: Everyday, 1,000,000 -> fee 3,000 -> total 1,003,000
    - expect: Savings, 1,999,000 -> fee 5,997 -> total 2,004,997 (just below the maximum)
    - expect: Savings, 2,000,000 -> fee 6,000 -> total 2,006,000 (maximum reached)
    - expect: Fee and Total are shown in HUF with thousands separators

#### 3.5. [high] Insufficient funds (amount plus fee versus balance)

**File:** `tests/transfer/insufficient-funds.spec.ts`

**Steps:**
  1. From Everyday Account (balance 1,250,000 HUF) to Kiss Péter, submit 1,245,000
    - expect: Review page: Amount 1,245,000 HUF, Fee 3,735 HUF, Total 1,248,735 HUF (total within balance)
  2. Submit 1,247,000 (fee 3,741, total 1,250,741, exceeds the balance by 741 HUF although the amount alone fits)
    - expect: URL stays /transfer and 'Insufficient funds.' is shown
  3. Submit 1,250,000 (the whole balance; the fee makes it exceed) and 2,000,000 (within the daily limit, above the balance)
    - expect: Both stay on /transfer with 'Insufficient funds.'
  4. Open /dashboard
    - expect: Everyday Account balance is still 1,250,000 HUF

#### 3.6. [high] Amount boundaries: per-transfer and daily limits

**File:** `tests/transfer/limits.spec.ts`

**Steps:**
  1. Read the note beside the form
    - expect: Text 'Limits: up to 10,000,000 HUF per transfer and 2,000,000 HUF per day.' [APP]
  2. From Savings Account (5,400,000 HUF) to Kiss Péter submit 1
    - expect: Review page: Amount 1 HUF, Fee 200 HUF, Total 201 HUF (smallest valid amount)
  3. Submit 2,000,000
    - expect: Review page: Amount 2,000,000 HUF, Fee 6,000 HUF, Total 2,006,000 HUF (exactly the daily limit is allowed; the limit applies to the amount, not the total)
  4. Submit 2,000,001
    - expect: URL stays /transfer and 'Daily limit of 2,000,000 HUF exceeded.' is shown
  5. Submit 10,000,000 (exactly the per-transfer limit, but above the daily limit)
    - expect: URL stays /transfer and 'Daily limit of 2,000,000 HUF exceeded.' is shown
  6. Submit 10,000,001 (above the per-transfer limit)
    - expect: URL stays /transfer and 'The maximum single transfer is 10,000,000 HUF.' is shown

#### 3.7. [high] Daily limit accumulates over several confirmed transfers

**File:** `tests/transfer/daily-limit-cumulative.spec.ts`

**Steps:**
  1. From Savings Account confirm a transfer of 1,500,000 HUF to Kiss Péter: GREMLIN_PIN, 'Confirm transfer', 'Approve payment' in the 'Gremlin Secure' frame
    - expect: URL /transfer/done; 'New balance, Savings Account' 3,895,500 HUF (5,400,000 - 1,500,000 - fee 4,500)
  2. Start a new transfer of 500,001 HUF from Savings Account
    - expect: URL stays /transfer and 'Daily limit of 2,000,000 HUF exceeded.' (1,500,000 + 500,001 > 2,000,000)
  3. Change the amount to 500,000 and continue
    - expect: Review page: Amount 500,000 HUF, Fee 1,500 HUF, Total 501,500 HUF (1,500,000 + 500,000 = exactly the daily limit)

#### 3.8. [high] Review page content and Change details

**File:** `tests/transfer/review.spec.ts`

**Steps:**
  1. Fill Everyday Account, Kiss Péter, IBAN verified, amount 5000, reference 'Rent', click 'Continue'
    - expect: URL /transfer/review, heading 'Review transfer'
    - expect: Table 'Transfer details': From Everyday Account; To Kiss Péter; IBAN HU72 9990 1017 1618 0339 8874 9892; Amount 5,000 HUF; Fee 200 HUF; Total 5,200 HUF
    - expect: Button 'Confirm transfer' and link 'Change details' are shown
  2. Click 'Change details'
    - expect: URL /transfer?edit=1; name 'Kiss Péter', IBAN, amount 5000 and reference 'Rent' are preserved
  3. Change the amount to 100,000 and click 'Continue'
    - expect: Review shows Amount 100,000 HUF, Fee 300 HUF, Total 100,300 HUF
  4. Open /dashboard
    - expect: Balances unchanged (Everyday 1,250,000 HUF, Savings 5,400,000 HUF): the review step alone moves no money

#### 3.9. [high] Confirm transfer with wrong or missing PIN is refused

**File:** `tests/transfer/confirm-wrong-pin.spec.ts`

**Steps:**
  1. Reach the review page for 5,000 HUF from Everyday Account to Kiss Péter and click 'Confirm transfer' without a PIN
    - expect: A 'Transaction PIN' field with hint '4 digits' is shown (custom element gb-secure-pin, test id 'secure-pin'; not in the accessibility tree, so getByTestId is acceptable here)
    - expect: Alert 'Wrong PIN.' and URL stays /transfer/review
  2. Type the wrong PIN '0000' (never GREMLIN_PIN) and confirm; repeat with '12' and 'abcd'
    - expect: 'Wrong PIN.' every time and URL stays /transfer/review
  3. Open /dashboard
    - expect: Everyday 1,250,000 HUF and Savings 5,400,000 HUF; Recent transactions still has the same 5 rows

#### 3.10. [high] Confirm transfer with correct PIN shows confirmation and updates balances

**File:** `tests/transfer/confirm-success.spec.ts`

**Steps:**
  1. Review a 5,000 HUF transfer from Everyday Account to Kiss Péter (Use, Check IBAN, amount 5000, Continue)
    - expect: URL /transfer/review; Amount 5,000 HUF, Fee 200 HUF, Total 5,200 HUF
  2. Click the Transaction PIN field (getByTestId('secure-pin'); closed shadow DOM, so type with the keyboard) and type GREMLIN_PIN, click 'Confirm transfer'
    - expect: A dialog 'Confirm payment' opens containing the iframe 'Gremlin Secure'
    - expect: Inside the frame: heading 'Approve this payment of 5,200 HUF' (the total, from the fee rule), text 'To Kiss Péter, HU72 9990 1017 1618 0339 8874 9892' and button 'Approve payment'
  3. Click 'Approve payment' inside the frame
    - expect: URL /transfer/done and text 'Transfer submitted'
    - expect: Reference matches /^GB-[A-Z0-9]{6}$/ (random, format only)
    - expect: Paid to Kiss Péter; IBAN HU72 9990 1017 1618 0339 8874 9892; Amount 5,000 HUF; Fee 200 HUF; Total 5,200 HUF
    - expect: 'New balance, Everyday Account' 1,244,800 HUF (1,250,000 - 5,200)
  4. Open /dashboard
    - expect: Everyday Account balance is 1,244,800 HUF; Savings Account unchanged at 5,400,000 HUF
    - expect: The first Recent transactions row is '<today> | Transfer to Kiss Péter | -5,200 HUF' (one line for amount plus fee), followed by the five seeded rows

#### 3.11. [high] Cancel the secure payment approval

**File:** `tests/transfer/confirm-cancel.spec.ts`

**Steps:**
  1. Review a 5,000 HUF transfer from Everyday Account to Kiss Péter
    - expect: URL /transfer/review; Amount 5,000 HUF, Fee 200 HUF, Total 5,200 HUF
  2. Type GREMLIN_PIN into the Transaction PIN field and click 'Confirm transfer'
    - expect: Dialog 'Confirm payment' with iframe 'Gremlin Secure' and heading 'Approve this payment of 5,200 HUF'
  3. Click 'Cancel' in the 'Confirm payment' dialog
    - expect: The dialog is closed (not visible)
    - expect: URL stays /transfer/review; it does not change to /transfer/done and 'Transfer submitted' is not shown
  4. Open /dashboard
    - expect: Everyday Account balance is still 1,250,000 HUF and Savings Account 5,400,000 HUF
    - expect: Recent transactions still has exactly the 5 seeded rows; no 'Transfer to Kiss Péter' row

### 4. Layout and browser compatibility

**Seed:** `seed.spec.ts`

Tester-identified gaps, not explored by the planner. Precondition: add Playwright projects for Firefox, WebKit and mobile devices to playwright.config.ts (only 'chromium' exists today) and run `npx playwright install firefox webkit`.

#### 4.1. [medium] Mobile and tablet layout

**File:** `tests/layout/responsive.spec.ts`

**Steps:**
  1. Run in the viewports of devices['iPhone 13'] (390 x 664), devices['Pixel 7'] (412 x 839) and a 768 x 1024 tablet. Sign in with GREMLIN_USER/GREMLIN_PASSWORD
    - expect: URL is /dashboard; 'Sign out' is reachable (directly or through a menu)
    - expect: The page does not scroll horizontally (document.documentElement.scrollWidth <= window.innerWidth)
  2. Read both accounts
    - expect: Everyday Account 1,250,000 HUF and Savings Account 5,400,000 HUF are visible, not cut off
  3. Open 'New transfer', use Kiss Péter, check the IBAN, enter 5000, continue
    - expect: All form fields, 'Check IBAN' and 'Continue' are visible and usable without horizontal scrolling
    - expect: Review page shows Amount 5,000 HUF, Fee 200 HUF, Total 5,200 HUF, all values visible within the viewport width
  4. Click 'Confirm transfer' without a PIN
    - expect: The Transaction PIN field and 'Wrong PIN.' are visible within the viewport

#### 4.2. [high] Core flows in Chromium, Firefox and WebKit

**File:** `tests/layout/cross-browser.spec.ts`

**Steps:**
  1. In each of the projects chromium, firefox and webkit, sign in with GREMLIN_USER/GREMLIN_PASSWORD
    - expect: URL is /dashboard and both balances are 1,250,000 HUF and 5,400,000 HUF
  2. Create transfers to Kiss Péter for 10,000 (Everyday), 100,000 (Everyday) and 2,000,000 (Savings) and read the review page
    - expect: Fees 200, 300 and 6,000 HUF; totals 10,200, 100,300 and 2,006,000 HUF in every browser (same number formatting)
  3. Submit 2,000,001 from Savings
    - expect: 'Daily limit of 2,000,000 HUF exceeded.' in every browser
  4. On a 5,000 HUF review, type '0000' into the Transaction PIN custom element and confirm
    - expect: The field accepts input and 'Wrong PIN.' is shown in every browser
  5. Complete the 5,000 HUF transfer as in 3.10 (GREMLIN_PIN, 'Confirm transfer', 'Approve payment' in the 'Gremlin Secure' iframe), then sign out
    - expect: URL /transfer/done; Everyday balance 1,244,800 HUF; after 'Sign out' the URL is /login in every browser
    - expect: Do not run 1.3 (lockout) in parallel across browsers

## Open questions and suspected bugs [OBSERVED]

- Empty sign-in fields give only the generic 'Wrong username or password.', no per-field message.
- Form validation messages stay visible after the field is corrected, until 'Continue' is pressed again. Confirm whether they should clear; if so, add a test.fail() test.
- 'Enter an amount greater than 0.' is also shown for decimals (1.5, 5000.50) and text ('abc'); a more specific message may be expected.
- '1,000' and '1 000' are accepted as 1,000 HUF; confirm separators are intended.
- Fee rounding is not stated in the rule. Observed: 66,800 -> 200 (0.3% = 200.4) and 1,246,200 -> 3,739 (3,738.6), which suggests rounding to the nearest forint. Add rounding cases once the rule is confirmed.
- The fee maximum (6,000 HUF) can only be reached at exactly 2,000,000 HUF because of the daily limit; confirm whether the cap is meant for a higher limit (for example in a later release).
- When several rules fail (10,000,000 from Savings: daily limit and balance), the app shows the daily-limit message; message precedence is not a stated rule.
- A valid German IBAN (DE89 3704 0044 0532 0130 00) is rejected as 'Invalid IBAN'. Domestic-only is plausible but not stated.
- The user's own Everyday IBAN is accepted as a beneficiary; should this be allowed or flagged?
- After 'Change details' the preserved IBAN is accepted without re-checking.
- The Reference entered on the form is shown nowhere: not on the review page, the /transfer/done page or the transaction list (second run). Expected at least on review/confirmation.
- A 200-character beneficiary name is silently cut to 70 characters on the review page; confirm the maximum length and whether a validation message is expected.
- Chart data does not reconcile with Recent transactions (2026-09-27: chart 7,600 HUF, mobile bill 7,990 HUF; 2026-09-30: chart 11,800 HUF, grocery 18,450 HUF). May be independent demo data.
- No PIN lockout was seen after 6 wrong PINs.
- Not observed: whether the daily limit counts the fee, whether valid credentials are refused during the lockout, what /transfer/done shows when opened without a transfer.
- Releases 2 and 3 were not explored (possible TOTP step or other changes).
