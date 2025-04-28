import type { Locator, Page } from '@playwright/test';
import type { NavigationBar } from '@podman-desktop/tests-playwright';
import { expect as playExpect, PreferencesPage } from '@podman-desktop/tests-playwright';

export class ExtensionAILabPreferencesPage extends PreferencesPage {
  public static readonly tabName = 'Extension: AI Lab';
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: ExtensionAILabPreferencesPage.tabName });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  public static async openAILabPreferences(
    navigationBar: NavigationBar,
    page: Page,
  ): Promise<ExtensionAILabPreferencesPage> {
    const dashboardPage = await navigationBar.openDashboard();
    await playExpect(dashboardPage.mainPage).toBeVisible();
    const settingsBar = await navigationBar.openSettings();
    await playExpect(settingsBar.preferencesTab).toBeVisible();
    await settingsBar.expandPreferencesTab();
    await playExpect(settingsBar.preferencesTab).toBeVisible();
    await settingsBar.getPreferencesLinkLocator('Extension: AI Lab').click();
    const aiLabPreferencesPage = new ExtensionAILabPreferencesPage(page);
    await aiLabPreferencesPage.waitForLoad();
    return aiLabPreferencesPage;
  }

  public async disableGPUPreference(): Promise<void> {
    await this.content
      .getByRole('checkbox', { name: 'Experimental GPU support for inference servers' })
      .uncheck({ force: true });
  }

  public async enableGPUPreference(): Promise<void> {
    await this.content
      .getByRole('checkbox', { name: 'Experimental GPU support for inference servers' })
      .check({ force: true });
  }
  public async isGPUPreferenceEnabled(): Promise<boolean> {
    const checkbox = this.content.getByRole('checkbox', { name: 'Experimental GPU support for inference servers' });
    return await checkbox.isChecked();
  }
}
