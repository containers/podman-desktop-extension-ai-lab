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
import { handleConfirmationDialog, podmanAILabExtension } from '@podman-desktop/tests-playwright';

export class AiRunningAppsPage extends AILabBasePage {
  constructor(page: Page, webview: Page) {
    super(page, webview, 'AI Apps');
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async getRowForApp(appName: string): Promise<Locator> {
    const rows = await this.getAllTableRows();
    for (const row of rows) {
      const appNameCellCount = await row.getByRole('cell').nth(3).getByText(appName).count();
      if (appNameCellCount) {
        return row;
      }
    }
    throw new Error(`No row found for app ${appName}`);
  }

  async getCurrentStatusForApp(appName: string): Promise<string> {
    const row = await this.getRowForApp(appName);
    return `${await row.getByRole('cell').nth(1).getByRole('status').getAttribute('title', { timeout: 60_000 })}`;
  }

  async restartApp(appName: string): Promise<void> {
    const dropDownMenu = await this.openKebabMenuForApp(appName);
    const restartButton = dropDownMenu.getByTitle('Restart AI App');
    await playExpect(restartButton).toBeVisible();
    await restartButton.click();

    await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Confirm');
  }

  async stopApp(appName: string): Promise<void> {
    const row = await this.getRowForApp(appName);
    const stopButton = row.getByLabel('Stop AI App');
    await playExpect(stopButton).toBeEnabled();
    await stopButton.click();
  }

  async openKebabMenuForApp(appName: string): Promise<Locator> {
    const row = await this.getRowForApp(appName);
    const kebabMenu = row.getByLabel('kebab menu');
    await playExpect(kebabMenu).toBeEnabled();
    await kebabMenu.click();
    return this.webview.getByTitle('Drop Down Menu Items');
  }

  async deleteAIApp(appName: string): Promise<void> {
    const dropDownMenu = await this.openKebabMenuForApp(appName);
    const deleteButton = dropDownMenu.getByTitle('Delete AI App');
    await playExpect(deleteButton).toBeVisible();
    await deleteButton.click();

    await handleConfirmationDialog(this.page, podmanAILabExtension.extensionName, true, 'Confirm');
  }

  async appExists(appName: string): Promise<boolean> {
    try {
      await this.getRowForApp(appName);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No row found for app')) {
        return false;
      } else {
        throw error;
      }
    }
  }

  private async getAllTableRows(): Promise<Locator[]> {
    return await this.webview.getByRole('row').all();
  }
}
