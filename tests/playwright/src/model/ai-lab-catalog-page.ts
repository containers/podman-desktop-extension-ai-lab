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
  }

  async getModelRowByName(modelName: string): Promise<Locator | undefined> {
    const modelRows = await this.getAllModelRows();
    for (const modelRow of modelRows) {
      const modelNameCell = modelRow.getByLabel(modelName, { exact: true });
      if (await modelNameCell.isVisible()) {
        return modelRow;
      }
    }

    return undefined;
  }

  private async getAllModelRows(): Promise<Locator[]> {
    return this.modelsGroup.getByRole('row').all();
  }
}