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
import { AILabCreatingModelServicePage } from './ai-lab-creating-model-service-page';

export class AiModelServicePage extends AILabBasePage {
  readonly additionalActions: Locator;
  readonly deleteSelectedItems: Locator;
  readonly toggleAllCheckbox: Locator;
  readonly newModelButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Model Services');
    this.additionalActions = this.webview.getByRole('group', { name: 'additionalActions' });
    this.deleteSelectedItems = this.additionalActions.getByRole('button', { name: 'Delete' });
    this.toggleAllCheckbox = this.webview.getByRole('checkbox').and(this.webview.getByLabel('Toggle all'));
    this.newModelButton = this.additionalActions.getByRole('button', { name: 'New Model Service' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async checkAllModelsForDeletion(): Promise<void> {
    await playExpect(this.toggleAllCheckbox).toBeVisible();
    await this.toggleAllCheckbox.check();
    await playExpect(this.toggleAllCheckbox).toBeChecked();
  }

  async navigateToCreateNewModelPage(): Promise<AILabCreatingModelServicePage> {
    await playExpect(this.newModelButton).toBeEnabled();
    await this.newModelButton.click();
    return new AILabCreatingModelServicePage(this.page, this.webview);
  }

  async deleteAllCurrentModels(): Promise<void> {
    if (!(await this.toggleAllCheckbox.count())) return;

    await this.checkAllModelsForDeletion();
    await playExpect(this.deleteSelectedItems).toBeEnabled();
    await this.deleteSelectedItems.click();

    await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Confirm');
  }

  async getCurrentModelCount(): Promise<number> {
    return (await this.getAllTableRows()).length;
  }

  private async getAllTableRows(): Promise<Locator[]> {
    return await this.webview.getByRole('row').all();
  }
}
