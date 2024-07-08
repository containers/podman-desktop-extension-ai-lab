/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type { Locator, Page } from '@playwright/test';
import { expect as playExpect } from '@playwright/test';
import { handleConfirmationDialog } from '@podman-desktop/tests-playwright';

export class AILabPage {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;
  readonly navigationBar: Locator;

  readonly recipesCatalogButton: Locator;
  readonly runningAppsButton: Locator;
  readonly catalogButton: Locator;
  readonly servicesButton: Locator;
  readonly playgroundsButton: Locator;

  readonly recipesCatalogPage: Locator;
  readonly recipesCatalogContent: Locator;
  readonly recipesCatalogNaturalLanguageProcessing: Locator;
  readonly recipesCatalogAudio: Locator;
  readonly recipesCatalogComputerVision: Locator;

  readonly startRecipeButton: Locator;
  readonly confirmStartRecipeButton: Locator;
  readonly recipeStatus: Locator;

  readonly applicationDetailsPanel: Locator;
  readonly openAIAppButton: Locator;
  readonly deleteAIAppButton: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.heading = webview.getByLabel('Welcome to Podman AI Lab');
    this.navigationBar = webview.getByLabel('PreferencesNavigation');

    this.recipesCatalogButton = this.navigationBar.getByLabel('Recipes Catalog', { exact: true });
    this.runningAppsButton = this.navigationBar.getByLabel('Running');
    this.catalogButton = this.navigationBar.getByLabel('Catalog', { exact: true });
    this.servicesButton = this.navigationBar.getByLabel('Services');
    this.playgroundsButton = this.navigationBar.getByLabel('Playgrounds');

    this.recipesCatalogPage = webview.getByRole('region', { name: 'Recipe Catalog' })
    this.recipesCatalogContent = this.recipesCatalogPage.getByRole('region', { name: 'content', exact: true }).first();
    this.recipesCatalogNaturalLanguageProcessing = this.recipesCatalogContent.getByRole('region', { name: 'Natural Language Processing', exact: true });
    this.recipesCatalogAudio = this.recipesCatalogContent.getByRole('region', { name: 'Audio', exact: true });
    this.recipesCatalogComputerVision = this.recipesCatalogContent.getByRole('region', { name: 'Computer Vision', exact: true });

    this.startRecipeButton = this.webview.getByRole('button', { name: 'Start recipe' });
    this.confirmStartRecipeButton = this.webview.getByRole('button', { name: /Start(\s+([A-Za-z]+\s+)+)recipe/i });
    this.recipeStatus = this.webview.getByRole('status');

    this.applicationDetailsPanel = webview.getByLabel('application details panel');
    this.openAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Open AI App' });
    this.deleteAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Delete AI App' });
  }

  async waitForPageLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
    await playExpect(this.navigationBar).toBeVisible();
    await playExpect(this.recipesCatalogButton).toBeVisible();
    await playExpect(this.runningAppsButton).toBeVisible();
    await playExpect(this.catalogButton).toBeVisible();
    await playExpect(this.servicesButton).toBeVisible();
    await playExpect(this.playgroundsButton).toBeVisible();
  }

  async openRecipesCatalog(): Promise<void> {
    await playExpect(this.recipesCatalogButton).toBeVisible();
    await this.recipesCatalogButton.click();
    await this.page.waitForTimeout(2000);
    await playExpect(this.recipesCatalogPage).toBeVisible();
    await playExpect(this.recipesCatalogContent).toBeVisible();
    await playExpect(this.recipesCatalogNaturalLanguageProcessing).toBeVisible();
    await playExpect(this.recipesCatalogAudio).toBeVisible();
    await playExpect(this.recipesCatalogComputerVision).toBeVisible();
  }

  async openRecipesCatalogApp(category: Locator, appName: string): Promise<void> {
    await this.openRecipesCatalog();
    await category.getByRole('region', { name: 'content', exact: true }).first().getByRole('region', { name: appName, exact: true }).getByRole('button', { name: 'More details' }).click({ timeout: 5_000 });
    await playExpect(this.webview.getByRole('heading', { name: appName })).toBeVisible();
  }

  /**
   * @throws {Error} If the app details are not visible or Delete AI App button is not visible
   */
  async tryDeleteOpenApp(): Promise<void> {
    await playExpect(this.applicationDetailsPanel).toBeVisible();
    await this.deleteAIAppButton.click({ timeout: 5_000 });
    try {
      await playExpect(this.page.getByRole('dialog', { name: 'Podman AI Lab' })).toBeVisible();
      await handleConfirmationDialog(this.page, 'Confirm');
    } catch(error) {
      console.warn(`Warning: Delete app confirmation dialog interaction failed, possibly app is not installed.\n\t${error}`);
    }
    await playExpect(this.applicationDetailsPanel).toContainText('AI App Removed', { timeout: 30_000 });
    await playExpect(this.startRecipeButton).toBeVisible();
  }

  async startOpenApp(): Promise<void> {
    await this.startRecipeButton.click({ timeout: 5_000 });
    await this.confirmStartRecipeButton.click({ timeout: 5_000 });
    try {
      await playExpect(this.page.getByRole('dialog', { name: 'Podman AI Lab' })).toBeVisible();
      await handleConfirmationDialog(this.page, 'Reset');
    } catch (error) {
      console.warn(`Warning: Could not reset the app, repository probably clean.\n\t${error}`);
    }
    await playExpect(this.recipeStatus).toContainText('AI App is running', { timeout: 720_000 });
  }
}
