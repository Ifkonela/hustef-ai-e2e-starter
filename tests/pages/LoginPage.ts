import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly heading: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly alert: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Sign in to Gremlin Bank' });
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.alert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async signIn(user: string, password: string) {
    await this.username.fill(user);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
