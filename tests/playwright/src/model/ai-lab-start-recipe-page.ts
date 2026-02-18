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
import {
  StatusBar,
  TasksPage,
  handleConfirmationDialog,
  podmanAILabExtension,
  waitUntil,
} from '@podman-desktop/tests-playwright';
import { AILabNavigationBar } from './ai-lab-navigation-bar';

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
    this.startRecipeButton = this.webview.getByRole('button', { name: /^Start .+ recipe$/i });
    this.openAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Open AI App' });
    this.deleteAIAppButton = this.applicationDetailsPanel.getByRole('button', { name: 'Delete AI App' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async startRecipe(
    appName: string,
    modelDownloadTimeout: number = 500_000,
    applicationStartTimeout: number = 900_000,
  ): Promise<void> {
    await playExpect(this.startRecipeButton).toBeEnabled();
    await this.startRecipeButton.click();
    const POLLING_INTERVAL = 10_000;
    let latestStatus = '';
    let latestStatusTimeout = 0;

    try {
      await handleConfirmationDialog(this.page, podmanAILabExtension.extensionName, true, 'Reset');
    } catch (error) {
      console.warn(`Warning: Could not reset the app, repository probably clean.\n\t${error}`);
    }

    await waitUntil(
      async () => {
        latestStatus = await this.getLatestStatus();
        if (/[Ee]rror/.test(latestStatus)) {
          throw new Error(`Error encountered while starting application: ${latestStatus}`);
        }
        const progress = await this.getModelDownloadProgress();
        if (progress < 100) {
          console.log(
            `Current model download progress: ${progress}%. Waiting for it to reach 100%. (timeout: ${latestStatusTimeout}ms of ${modelDownloadTimeout}ms)`,
          );
          latestStatusTimeout += POLLING_INTERVAL;
          await this.refreshStartRecipeUI(this.page, this.webview, appName);
        }
        return progress === 100;
      },
      {
        timeout: modelDownloadTimeout,
        diff: POLLING_INTERVAL,
        message: 'WaitTimeout reached when waiting for mode download progress to be 100 percent',
      },
    );

    await waitUntil(
      async () => {
        const currentStatus = await this.getLatestStatus();
        if (currentStatus !== latestStatus) {
          latestStatus = currentStatus;
          latestStatusTimeout = 0;
        } else {
          latestStatusTimeout += POLLING_INTERVAL;
        }
        if (/[Ee]rror/.test(latestStatus)) {
          throw new Error(`Error encountered while starting application: ${latestStatus}`);
        }
        if (!latestStatus.includes('AI App is running')) {
          console.log(
            `Latest status: ${latestStatus} (timeout: ${latestStatusTimeout}ms of ${applicationStartTimeout}ms)`,
          );
          await this.refreshStartRecipeUI(this.page, this.webview, appName);
        }
        return latestStatus.includes('AI App is running');
      },
      {
        timeout: applicationStartTimeout,
        diff: POLLING_INTERVAL,
        message: 'WaitTimeout reached when waiting for text: AI App is running',
      },
    );
  }

  async getModelDownloadProgress(): Promise<number> {
    const content = await this.getDownloadStatusContent();

    if (!content) return 0;
    if (content.includes('already present on disk')) {
      console.log('Model already present on disk');
      return 100;
    }

    // eslint-disable-next-line sonarjs/slow-regex
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
    return await this.getStatusContent(3);
  }

  private async getLatestStatus(): Promise<string> {
    return await this.getStatusContent();
  }

  private async getStatusContent(index: number = 0): Promise<string> {
    const statusList = await this.getStatusListLocator();
    let currentElement: Locator;

    if (index) {
      if (statusList.length < index) return '';
      currentElement = statusList[index - 1];
    } else {
      if (statusList.length < 1) return '';
      currentElement = statusList[statusList.length - 1];
    }

    const content = await currentElement.textContent();

    if (!content) return '';

    const viewErrorButton = currentElement.getByRole('button', { name: 'View error' });
    const note = currentElement.getByRole('note');

    if (await viewErrorButton.isVisible()) {
      await viewErrorButton.click();
      await this.page.waitForTimeout(500);
    }

    if ((await note.count()) > 0) {
      const noteContent = await note.textContent();
      throw new Error(`Error encountered while starting application: ${noteContent}`);
    }
    return content;
  }

  private async refreshStartRecipeUI(page: Page, webView: Page, appName: string): Promise<void> {
    console.debug('UI might be stuck, refreshing...');
    // do not leave webview, ie. do not switch to Dashboard
    const aiNavBar = new AILabNavigationBar(page, webView);
    await aiNavBar.openRunningApps();
    console.debug('Finding Tasks in status Bar');
    const statusBar = new StatusBar(page);
    await statusBar.tasksButton.click();
    console.debug('Opened Tasks in status Bar');
    const tasksManager = new TasksPage(page);
    console.debug('Finding particular task in task manager and switching to it');
    await tasksManager.navigateToTask(`Pulling ${appName}`);
    console.debug('Start recipe page should be back');
    await playExpect(this.heading).toBeVisible();
  }
}
