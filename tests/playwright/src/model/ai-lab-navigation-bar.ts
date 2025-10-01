/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import { AiRunningAppsPage } from './ai-lab-running-apps-page';
import { AiModelServicePage } from './ai-lab-model-service-page';
import { AILabCatalogPage } from './ai-lab-catalog-page';
import { AILabPlaygroundsPage } from './ai-lab-playgrounds-page';
import { AILabLocalServerPage } from './ai-lab-local-server-page';
import { AILabDashboardPage } from './ai-lab-dashboard-page';
import { AILabTryInstructLabPage } from './ai-lab-try-instructlab-page';
import { AiLlamaStackPage } from './ai-lab-model-llamastack-page';

export class AILabNavigationBar extends AILabBasePage {
  readonly navigationBar: Locator;
  readonly dashboardButton: Locator;
  readonly recipesCatalogButton: Locator;
  readonly runningAppsButton: Locator;
  readonly catalogButton: Locator;
  readonly servicesButton: Locator;
  readonly playgroundsButton: Locator;
  readonly llamaStackButton: Locator;
  readonly tuneButton: Locator;
  readonly localServerButton: Locator;
  readonly tryInstructLabButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, undefined);
    this.navigationBar = this.webview.getByRole('navigation', { name: 'PreferencesNavigation' });
    this.dashboardButton = this.navigationBar.getByRole('link', { name: 'Dashboard', exact: true });
    this.recipesCatalogButton = this.navigationBar.getByRole('link', { name: 'Recipe Catalog', exact: true });
    this.runningAppsButton = this.navigationBar.getByRole('link', { name: 'Running' });
    this.catalogButton = this.navigationBar.getByRole('link', { name: 'Catalog', exact: true });
    this.servicesButton = this.navigationBar.getByRole('link', { name: 'Services' });
    this.playgroundsButton = this.navigationBar.getByRole('link', { name: 'Playgrounds' });
    this.llamaStackButton = this.navigationBar.getByRole('link', { name: 'Llama Stack' });
    this.tuneButton = this.navigationBar.getByRole('link', { name: 'Tune with InstructLab' });
    this.localServerButton = this.navigationBar.getByRole('link', { name: 'Local Server' });
    this.tryInstructLabButton = this.navigationBar.getByRole('link', { name: 'Try InstructLab' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.navigationBar).toBeVisible();
  }

  async openDashboard(): Promise<AILabDashboardPage> {
    await playExpect(this.dashboardButton).toBeVisible();
    await this.dashboardButton.click();
    return new AILabDashboardPage(this.page, this.webview);
  }

  async openRecipesCatalog(): Promise<AILabRecipesCatalogPage> {
    await playExpect(this.recipesCatalogButton).toBeVisible();
    await this.recipesCatalogButton.click();
    return new AILabRecipesCatalogPage(this.page, this.webview);
  }

  async openRunningApps(): Promise<AiRunningAppsPage> {
    await playExpect(this.runningAppsButton).toBeVisible();
    await this.runningAppsButton.click();
    return new AiRunningAppsPage(this.page, this.webview);
  }

  async openServices(): Promise<AiModelServicePage> {
    await playExpect(this.servicesButton).toBeVisible();
    await this.servicesButton.click();
    return new AiModelServicePage(this.page, this.webview);
  }

  async openCatalog(): Promise<AILabCatalogPage> {
    await playExpect(this.catalogButton).toBeVisible();
    await this.catalogButton.click();
    return new AILabCatalogPage(this.page, this.webview);
  }

  async openPlaygrounds(): Promise<AILabPlaygroundsPage> {
    await playExpect(this.playgroundsButton).toBeVisible();
    await this.playgroundsButton.click();
    return new AILabPlaygroundsPage(this.page, this.webview);
  }

  async openLlamaStack(): Promise<AiLlamaStackPage> {
    await playExpect(this.llamaStackButton).toBeVisible();
    await this.llamaStackButton.click();
    return new AiLlamaStackPage(this.page, this.webview);
  }

  async openLocalServer(): Promise<AILabLocalServerPage> {
    await playExpect(this.localServerButton).toBeVisible();
    await this.localServerButton.click();
    return new AILabLocalServerPage(this.page, this.webview);
  }

  async openTryInstructLab(): Promise<AILabTryInstructLabPage> {
    await playExpect(this.tryInstructLabButton).toBeVisible();
    await this.tryInstructLabButton.click();
    return new AILabTryInstructLabPage(this.page, this.webview);
  }
}
