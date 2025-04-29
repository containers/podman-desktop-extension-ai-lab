/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *025
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

export class AILabLocalServerPage extends AILabBasePage {
  readonly localServerPort: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Local Server');
    this.localServerPort = this.webview.getByRole('textbox', { name: 'Port input' });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }

  async getLocalServerPort(): Promise<string> {
    await playExpect(this.localServerPort).toBeVisible();
    try {
      return await this.localServerPort.inputValue();
    } catch {
      throw new Error('Could not get local server port');
    }
  }
}
