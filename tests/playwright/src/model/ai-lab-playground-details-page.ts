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
import { AILabPlaygroundsPage } from './ai-lab-playgrounds-page';
import { handleConfirmationDialog } from '@podman-desktop/tests-playwright';

export class AILabPlaygroundDetailsPage extends AILabBasePage {
  readonly name: string;
  readonly deletePlaygroundButton: Locator;
  readonly conversationSectionLocator: Locator;
  readonly settingsPanelLocator: Locator;
  readonly parametersSectionLocator: Locator;
  readonly temperatureSliderLocator: Locator;
  readonly maxTokensSliderLocator: Locator;
  readonly topPSliderLocator: Locator;

  constructor(page: Page, webview: Page, playgroundName: string) {
    super(page, webview, playgroundName);

    this.name = playgroundName;
    this.deletePlaygroundButton = this.webview.getByRole('button', { name: 'Delete conversation' });
    this.conversationSectionLocator = this.webview.getByLabel('conversation', { exact: true });
    this.settingsPanelLocator = this.webview.getByLabel('settings panel', { exact: true });
    this.parametersSectionLocator = this.settingsPanelLocator.getByLabel('parameters', { exact: true });
    this.temperatureSliderLocator = this.parametersSectionLocator.getByLabel('temperature slider', { exact: true });
    this.maxTokensSliderLocator = this.parametersSectionLocator.getByLabel('max tokens slider', { exact: true });
    this.topPSliderLocator = this.parametersSectionLocator.getByLabel('top-p slider', { exact: true });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async deletePlayground(): Promise<AILabPlaygroundsPage> {
    await playExpect(this.deletePlaygroundButton).toBeEnabled();
    await this.deletePlaygroundButton.click();
    await handleConfirmationDialog(this.page, 'Podman AI Lab', true, 'Confirm');
    return new AILabPlaygroundsPage(this.page, this.webview);
  }
}
