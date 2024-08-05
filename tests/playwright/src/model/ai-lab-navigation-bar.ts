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
import { AILabRecipesCatalogPage } from './ai-lab-recipes-catalog-page';

export class AILabNavigationBar extends AILabBasePage {
  readonly navigationBar: Locator;
  readonly recipesCatalogButton: Locator;
  readonly runningAppsButton: Locator;
  readonly catalogButton: Locator;
  readonly servicesButton: Locator;
  readonly playgroundsButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview);
    this.navigationBar = webview.getByRole('navigation', { name: 'PreferencesNavigation' });
    this.recipesCatalogButton = this.navigationBar.getByRole('link', { name: 'Recipes Catalog', exact: true });
    this.runningAppsButton = this.navigationBar.getByRole('link', { name: 'Running' });
    this.catalogButton = this.navigationBar.getByRole('link', { name: 'Catalog', exact: true });
    this.servicesButton = this.navigationBar.getByRole('link', { name: 'Services' });
    this.playgroundsButton = this.navigationBar.getByRole('link', { name: 'Playgrounds' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.navigationBar).toBeVisible();
  }

  async openRecipesCatalog(): Promise<AILabRecipesCatalogPage> {
    await playExpect(this.recipesCatalogButton).toBeEnabled();
    await this.recipesCatalogButton.click();
    return new AILabRecipesCatalogPage(this.page, this.webview);
  }
}
