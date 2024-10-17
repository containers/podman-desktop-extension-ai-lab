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
import { AILabStartRecipePage } from './ai-lab-start-recipe-page';

export class AILabAppDetailsPage extends AILabBasePage {
  readonly appName: string;
  readonly startRecipeButton: Locator;

  constructor(page: Page, webview: Page, appName: string) {
    super(page, webview, appName);
    this.appName = appName;
    this.startRecipeButton = this.webview.getByRole('button', { name: 'Start recipe' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async deleteLocalClone(): Promise<void> {
    throw new Error('Method Not implemented');
  }

  async startNewDeployment(): Promise<void> {
    await playExpect(this.startRecipeButton).toBeEnabled();
    await this.startRecipeButton.click();
    const starRecipePage = new AILabStartRecipePage(this.page, this.webview);
    await starRecipePage.waitForLoad();
    await starRecipePage.startRecipe(this.appName);
  }

  async openRunningApps(): Promise<void> {
    throw new Error('Method Not implemented');
  }

  async deleteRunningApp(_containerName: string): Promise<void> {
    throw new Error('Method Not implemented');
  }
}
