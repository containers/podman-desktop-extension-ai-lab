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
import { handleConfirmationDialog, podmanAILabExtension } from '@podman-desktop/tests-playwright';
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

  async getModelNameByRow(row: Locator): Promise<string> {
    const modelNameCell = row.getByLabel('Model Name');
    const modelName = await modelNameCell.textContent();
    return modelName?.trim() ?? '';
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
    if (!modelName || modelName.trim() === '') {
      console.warn('Model name is empty, skipping deletion.');
      return;
    }
    const modelRow = await this.getModelRowByName(modelName);
    if (!modelRow) {
      throw new Error(`Model ${modelName} not found`);
    }
    const deleteButton = modelRow.getByRole('button', { name: 'Delete Model' });
    await playExpect.poll(async () => await deleteButton.isEnabled(), { timeout: 10_000 }).toBeTruthy();
    await deleteButton.focus();
    await deleteButton.click();
    await this.page.waitForTimeout(1_000);
    await handleConfirmationDialog(this.page, podmanAILabExtension.extensionName, true, 'Confirm');
    await playExpect.poll(async () => await this.isModelDownloaded(modelName), { timeout: 30_000 }).toBeFalsy();
  }

  async deleteAllModels(): Promise<void> {
    try {
      const modelRows = await this.getAllModelRows();
      if (modelRows.length === 0) {
        return;
      }

      for (const modelRow of modelRows) {
        const modelName = await this.getModelNameByRow(modelRow);
        if (await this.isModelDownloaded(modelName)) {
          await this.deleteModel(modelName);
        }
      }

      await playExpect.poll(async () => (await this.getAllModelRows()).length === 0, { timeout: 60_000 }).toBeTruthy();
    } catch (error) {
      const remainingModels = await this.getAllModelRows();
      const remainingModelNames = [];
      for (const modelRow of remainingModels) {
        remainingModelNames.push(await this.getModelNameByRow(modelRow));
      }
      console.error('Error during deleteAllModels:', error, 'Remaining models:', remainingModelNames);
    }
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
