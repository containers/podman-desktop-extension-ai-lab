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
import { expect as playExpect, ExtensionDetailsPage } from '@podman-desktop/tests-playwright';

export class AILabExtensionDetailsPage extends ExtensionDetailsPage {
  readonly errorTab: Locator;

  constructor(page: Page) {
    super(page, 'Podman AI Lab extension');
    this.errorTab = this.tabs.getByRole('button', { name: 'Error' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async checkIsActive(statusTest: string): Promise<void> {
    await playExpect(this.status).toHaveText(statusTest);
  }

  async checkForErrors(): Promise<void> {
    // we would like to propagate the error's stack trace into test failure message
    let stackTrace = '';
    if ((await this.errorTab.count()) > 0) {
      await this.activateTab('Error');
      stackTrace = await this.errorStackTrace.innerText();
    }
    await playExpect(this.errorTab, `Error Tab was present with stackTrace: ${stackTrace}`).not.toBeVisible();
  }
}
