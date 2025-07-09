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

export class AILabTryInstructLabPage extends AILabBasePage {
  readonly startInstructLabButton: Locator;
  readonly openInstructLabButton: Locator;
  readonly statusMessageBox: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Run InstructLab as a container');
    this.startInstructLabButton = this.webview.getByRole('button', { name: 'Start InstructLab container' });
    this.openInstructLabButton = this.webview.getByRole('button', { name: 'Open InstructLab container' });
    this.statusMessageBox = this.webview.getByRole('status');
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }
}
