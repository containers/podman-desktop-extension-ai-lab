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
import { AILabServiceDetailsPage } from './ai-lab-service-details-page';

export class AILabCreatingModelServicePage extends AILabBasePage {
  readonly modelInput: Locator;
  readonly portInput: Locator;
  readonly createButton: Locator;
  readonly openServiceDetailsButton: Locator;
  readonly serviceStatus: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Creating Model service');
    this.modelInput = this.webview.getByLabel('Select Model');
    this.portInput = this.webview.getByLabel('Port input');
    this.createButton = this.webview.getByRole('button', { name: 'Create service' });
    this.openServiceDetailsButton = this.webview.getByRole('button', { name: 'Open service details' });
    this.serviceStatus = this.webview.getByRole('status');
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async getCurrentStatus(): Promise<string> {
    const statusList = await this.getStatusListLocator();

    if (statusList.length < 1) return '';

    const content = await statusList[statusList.length - 1].textContent();
    if (!content) return '';

    return content;
  }

  async createService(modelName: string = '', port: number = 0): Promise<AILabServiceDetailsPage> {
    if (modelName) {
      await this.modelInput.fill(modelName);
      await this.webview.keyboard.press('Enter');
    }

    if (port) {
      await this.portInput.clear();
      await this.portInput.fill(port.toString());
    }

    await playExpect(this.createButton).toBeEnabled();
    await this.createButton.click();

    await playExpect
      .poll(async () => await this.getCurrentStatus(), { timeout: 300_000 })
      .toContain('Creating container');
    await playExpect(this.openServiceDetailsButton).toBeEnabled();
    await this.openServiceDetailsButton.click();
    return new AILabServiceDetailsPage(this.page, this.webview);
  }

  private async getStatusListLocator(): Promise<Locator[]> {
    return await this.serviceStatus.locator('ul > li').all();
  }
}
