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
import { AILabPlaygroundDetailsPage } from './ai-lab-playground-details-page';

export class AILabPlaygroundsPage extends AILabBasePage {
  readonly additionalActions: Locator;
  readonly newPlaygroundButton: Locator;
  readonly playgroundNameInput: Locator;
  readonly createPlaygroundButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Playground Environments');
    this.additionalActions = this.webview.getByRole('group', { name: 'additionalActions' });
    this.newPlaygroundButton = this.additionalActions.getByRole('button', { name: 'New Playground', exact: true });
    this.playgroundNameInput = this.webview.getByRole('textbox', { name: 'playgroundName' });
    this.createPlaygroundButton = this.webview.getByRole('button', { name: 'Create playground', exact: true });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async createNewPlayground(name: string): Promise<this> {
    await playExpect(this.newPlaygroundButton).toBeEnabled();
    await this.newPlaygroundButton.click();
    await playExpect(this.playgroundNameInput).toBeVisible();
    await this.playgroundNameInput.fill(name);
    await playExpect(this.playgroundNameInput).toHaveValue(name);
    await playExpect(this.createPlaygroundButton).toBeEnabled();
    await this.createPlaygroundButton.click();
    return this;
  }

  async deletePlayground(playgroundName: string): Promise<this> {
    const playgroundRow = await this.getPlaygroundRowByName(playgroundName);
    if (!playgroundRow) {
      throw new Error(`Playground ${playgroundName} not found`);
    }
    const deleteButton = playgroundRow.getByRole('button', { name: 'Delete conversation', exact: true });
    await playExpect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Confirm');
    return this;
  }

  async doesPlaygroundExist(playgroundName: string): Promise<boolean> {
    return (await this.getPlaygroundRowByName(playgroundName)) !== undefined;
  }

  async goToPlaygroundDetails(playgroundName: string): Promise<AILabPlaygroundDetailsPage> {
    const playgroundRow = await this.getPlaygroundRowByName(playgroundName);
    if (!playgroundRow) {
      throw new Error(`Playground ${playgroundName} not found`);
    }

    const button = playgroundRow.getByRole('button', { name: playgroundName, exact: true });
    await playExpect(button).toBeVisible();
    await button.click();

    return new AILabPlaygroundDetailsPage(this.page, this.webview, playgroundName);
  }

  private async getPlaygroundRowByName(playgroundName: string): Promise<Locator | undefined> {
    const row = this.webview.getByRole('row', { name: playgroundName, exact: true });
    if ((await row.count()) > 0) {
      return row;
    }
    return undefined;
  }
}
