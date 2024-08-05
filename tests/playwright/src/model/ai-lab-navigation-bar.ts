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
import { AILabRecipesCatalogPage } from './ai-lab-recipes-catalog-page';

export class AILabNavigationBar {
  readonly page: Page;
  readonly webview: Page;
  readonly navigationBar: Locator;

  readonly recipesCatalogButton: Locator;
  readonly runningAppsButton: Locator;
  readonly catalogButton: Locator;
  readonly servicesButton: Locator;
  readonly playgroundsButton: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.navigationBar = webview.getByLabel('PreferencesNavigation');

    this.recipesCatalogButton = this.navigationBar.getByLabel('Recipes Catalog', { exact: true });
    this.runningAppsButton = this.navigationBar.getByLabel('Running');
    this.catalogButton = this.navigationBar.getByLabel('Catalog', { exact: true });
    this.servicesButton = this.navigationBar.getByLabel('Services');
    this.playgroundsButton = this.navigationBar.getByLabel('Playgrounds');
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.navigationBar).toBeVisible();
  }

  async openRecipesCatalog(): Promise<AILabRecipesCatalogPage> {
    await playExpect(this.recipesCatalogButton).toBeVisible();
    await playExpect(this.recipesCatalogButton).toBeEnabled();
    await this.recipesCatalogButton.click();
    return new AILabRecipesCatalogPage(this.page, this.webview);
  }
}
