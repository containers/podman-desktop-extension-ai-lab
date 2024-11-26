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

export class AILabServiceDetailsPage extends AILabBasePage {
  readonly endpointURL: Locator;
  readonly inferenceServerType: Locator;
  readonly modelName: Locator;
  readonly codeSnippet: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Service details');
    this.endpointURL = this.webview.getByLabel('Endpoint URL', { exact: true });
    this.inferenceServerType = this.webview.getByLabel('Inference Type', { exact: true });
    this.modelName = this.webview.getByLabel('Model name', { exact: true });
    this.codeSnippet = this.webview.getByLabel('Code Snippet', { exact: true });
  }

  async waitForLoad(): Promise<void> {
    await playExpect(this.heading).toBeVisible();
  }
}
