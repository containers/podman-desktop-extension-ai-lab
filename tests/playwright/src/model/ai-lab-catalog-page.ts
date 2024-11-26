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
import { AILabBasePage } from './ai-lab-base-page';
import { handleConfirmationDialog } from '@podman-desktop/tests-playwright';
import { AILabCreatingModelServicePage } from './ai-lab-creating-model-service-page';

export class AILabCatalogPage extends AILabBasePage {
  readonly catalogTable: Locator;
  readonly modelsGroup: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Models');
    this.catalogTable = this.webview.getByRole('table', { name: 'model' });
    this.modelsGroup = this.catalogTable.getByRole('rowgroup').nth(1);
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
    await playExpect(this.catalogTable).toBeVisible();
    await playExpect(this.modelsGroup).toBeVisible();
  }

  async getModelRowByName(modelName: string): Promise<Locator | undefined> {
    const modelRows = await this.getAllModelRows();
    for (const modelRow of modelRows) {
      const modelNameCell = modelRow.getByText(modelName, { exact: true });
      if ((await modelNameCell.count()) > 0) {
        return modelRow;
      }
    }

    return undefined;
  }

  async downloadModel(modelName: string): Promise<void> {
    const modelRow = await this.getModelRowByName(modelName);
    if (!modelRow) {
      throw new Error(`Model ${modelName} not found`);
    }
    const downloadButton = modelRow.getByRole('button', { name: 'Download Model' });
    await playExpect(downloadButton).toBeEnabled();
    await downloadButton.focus();
    await downloadButton.click();
  }

  async createModelService(modelName: string): Promise<AILabCreatingModelServicePage> {
    const modelRow = await this.getModelRowByName(modelName);
    if (!modelRow) {
      throw new Error(`Model ${modelName} not found`);
    }
    const createServiceButton = modelRow.getByRole('button', { name: 'Create Model Service' });
    await playExpect(createServiceButton).toBeEnabled();
    await createServiceButton.focus();
    await createServiceButton.click();

    return new AILabCreatingModelServicePage(this.page, this.webview);
  }

  async deleteModel(modelName: string): Promise<void> {
    const modelRow = await this.getModelRowByName(modelName);
    if (!modelRow) {
      throw new Error(`Model ${modelName} not found`);
    }
    const deleteButton = modelRow.getByRole('button', { name: 'Delete Model' });
    await playExpect(deleteButton).toBeEnabled();
    await deleteButton.focus();
    await deleteButton.click();
    await this.page.waitForTimeout(1_000);
    await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Confirm');
  }

  async isModelDownloaded(modelName: string): Promise<boolean> {
    const modelRow = await this.getModelRowByName(modelName);
    if (!modelRow) {
      return false;
    }

    const deleteButton = modelRow.getByRole('button', { name: 'Delete Model' });
    return (await deleteButton.count()) > 0;
  }

  private async getAllModelRows(): Promise<Locator[]> {
    return this.modelsGroup.getByRole('row').all();
  }
}
