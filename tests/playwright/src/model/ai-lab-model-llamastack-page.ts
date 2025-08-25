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
import { AILabBasePage } from './ai-lab-base-page';

export class AiLlamaStackPage extends AILabBasePage {
  readonly startLlamaStackContainerButton: Locator;
  readonly openLlamaStackContainerButton: Locator;
  readonly exploreLlamaStackEnvironmentButton: Locator;

  constructor(page: Page, webview: Page) {
    super(page, webview, 'Llama Stack');
    this.startLlamaStackContainerButton = this.webview.getByRole('button', { name: 'Start Llama Stack container' });
    this.openLlamaStackContainerButton = this.webview.getByRole('button', { name: 'Open Llama Stack container' });
    this.exploreLlamaStackEnvironmentButton = this.webview.getByRole('button', {
      name: 'Explore Llama-Stack environment',
    });
  }

  async waitForLoad(): Promise<void> {
    await this.startLlamaStackContainerButton.waitFor({ state: 'visible' });
  }

  async runLlamaStackContainer(): Promise<void> {
    await this.startLlamaStackContainerButton.click();
  }

  async waitForOpenLlamaStackContainerButton(): Promise<void> {
    await this.openLlamaStackContainerButton.waitFor({ state: 'visible' });
  }

  async waitForExploreLlamaStackEnvironmentButton(): Promise<void> {
    await this.exploreLlamaStackEnvironmentButton.waitFor({ state: 'visible' });
  }
}
