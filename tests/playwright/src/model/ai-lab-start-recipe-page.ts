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
    super(page, webview);
    this.heading = webview.getByLabel('Start Recipe');
    this.recipeStatus = this.webview.getByRole('status');
    this.applicationDetailsPanel = webview.getByLabel('application details panel');
    this.startRecipeButton = this.webview.getByRole('button', { name: /Start(\s+([A-Za-z]+\s+)+)recipe/i });
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
    await playExpect(this.recipeStatus).toContainText('AI App is running', { timeout: 720_000 });
  }
}
