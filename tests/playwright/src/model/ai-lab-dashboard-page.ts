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

import type { Page } from '@playwright/test';
import { expect as playExpect } from '@playwright/test';
import { AILabBasePage } from './ai-lab-base-page';
import { AILabNavigationBar } from './ai-lab-navigation-bar';

export class AILabDashboardPage extends AILabBasePage {
  readonly navigationBar: AILabNavigationBar;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Welcome to Podman AI Lab');
    this.navigationBar = new AILabNavigationBar(this.page, this.webview);
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
    await this.navigationBar.waitForLoad();
  }
}
