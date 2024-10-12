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
import { handleConfirmationDialog } from '@podman-desktop/tests-playwright';

export class AILabStartRecipePage extends AILabBasePage {
  readonly recipeStatus: Locator;
  readonly applicationDetailsPanel: Locator;
  readonly startRecipeButton: Locator;
  readonly openAIAppButton: Locator;
  readonly deleteAIAppButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Start recipe');
    this.recipeStatus = this.webview.getByRole('status');
    this.applicationDetailsPanel = this.webview.getByLabel('application details panel');
    this.startRecipeButton = this.webview.getByRole('button', { name: /Start(\s+([a-z]+\s+)+)recipe/i });
    this.openAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Open AI App' });
    this.deleteAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Delete AI App' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async startRecipe(): Promise<void> {
    await playExpect(this.startRecipeButton).toBeEnabled();
    await this.startRecipeButton.click();
    try {
      await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Reset');
    } catch (error) {
      console.warn(`Warning: Could not reset the app, repository probably clean.\n\t${error}`);
    }
    await playExpect
      .poll(async () => await this.getModelDownloadProgress(), { timeout: 720_000, intervals: [5_000] })
      .toBe(100);
    await playExpect(this.recipeStatus).toContainText('AI App is running', { timeout: 720_000 });
  }

  async getModelDownloadProgress(): Promise<number> {
    const content = await this.getDownloadStatusContent();

    if (!content) return 0;
    if (content.includes('already present on disk')) {
      console.log('Model already present on disk');
      return 100;
    }

    const regex = new RegExp(/(\d+)%/);
    const progressString = regex.exec(content);
    const progress = progressString ? parseInt(progressString[1]) : 0;
    console.log(`Model download progress: ${progress}%`);
    return progress;
  }

  private async getStatusListLocator(): Promise<Locator[]> {
    return await this.recipeStatus.locator('ul > li').all();
  }

  private async getDownloadStatusContent(): Promise<string> {
    const statusList = await this.getStatusListLocator();

    if (statusList.length < 3) return '';

    const content = await statusList[2].textContent();

    if (!content) return '';
    return content;
  }
}
