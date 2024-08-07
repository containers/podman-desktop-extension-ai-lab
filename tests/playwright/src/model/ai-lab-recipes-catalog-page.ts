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

import { expect as playExpect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { AILabBasePage } from './ai-lab-base-page';
import { AILabAppDetailsPage } from './ai-lab-app-details-page';

export class AILabRecipesCatalogPage extends AILabBasePage {
  readonly recipesCatalogPage: Locator;
  readonly recipesCatalogContent: Locator;
  readonly recipesCatalogNaturalLanguageProcessing: Locator;
  readonly recipesCatalogAudio: Locator;
  readonly recipesCatalogComputerVision: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Recipe Catalog');
    this.recipesCatalogPage = this.webview.getByRole('region', { name: 'Recipe Catalog' });
    this.recipesCatalogContent = this.recipesCatalogPage.getByRole('region', { name: 'content', exact: true }).first();
    this.recipesCatalogNaturalLanguageProcessing = this.recipesCatalogContent.getByRole('region', {
      name: 'Natural Language Processing',
      exact: true,
    });
    this.recipesCatalogAudio = this.recipesCatalogContent.getByRole('region', { name: 'Audio', exact: true });
    this.recipesCatalogComputerVision = this.recipesCatalogContent.getByRole('region', {
      name: 'Computer Vision',
      exact: true,
    });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
    await playExpect(this.recipesCatalogPage).toBeVisible();
  }

  async openRecipesCatalogApp(category: Locator, appName: string): Promise<AILabAppDetailsPage> {
    await playExpect(category).toBeVisible();
    await playExpect(this.getAppDetailsLocator(appName)).toBeEnabled();
    await this.getAppDetailsLocator(appName).click();
    return new AILabAppDetailsPage(this.page, this.webview, appName);
  }

  private getAppDetailsLocator(appName: string): Locator {
    return this.recipesCatalogContent
      .getByRole('region', { name: appName, exact: true })
      .getByRole('button', { name: 'More details' });
  }
}
