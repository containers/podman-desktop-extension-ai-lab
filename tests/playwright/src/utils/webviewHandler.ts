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
import type { NavigationBar, Runner } from '@podman-desktop/tests-playwright';
import { expect as playExpect } from '@podman-desktop/tests-playwright';
import { AILabNavigationBar } from 'src/model/ai-lab-navigation-bar';

export async function handleWebview(
  runner: Runner,
  page: Page,
  navigationBar: NavigationBar,
): Promise<[Page, Page, AILabNavigationBar]> {
  const AI_LAB_NAVBAR_EXTENSION_LABEL: string = 'AI Lab';
  const AI_LAB_PAGE_BODY_LABEL: string = 'Webview AI Lab';

  const aiLabPodmanExtensionButton = navigationBar.navigationLocator.getByRole('link', {
    name: AI_LAB_NAVBAR_EXTENSION_LABEL,
  });
  await playExpect(aiLabPodmanExtensionButton).toBeEnabled();
  await aiLabPodmanExtensionButton.click();
  await page.waitForTimeout(2_000);

  const webView = page.getByRole('document', { name: AI_LAB_PAGE_BODY_LABEL });
  await playExpect(webView).toBeVisible();

  // Wait for webview window to be ready
  await playExpect
    .poll(
      async () => {
        const windows = runner.getElectronApp().windows();
        return windows.length >= 2;
      },
      { timeout: 10_000, intervals: [500] },
    )
    .toBeTruthy();

  const [mainPage, webViewPage] = runner.getElectronApp().windows();
  await mainPage.evaluate(() => {
    const element = document.querySelector('webview');
    if (element) {
      (element as HTMLElement).focus();
    }
  });
  const aiLabNavigationBar = new AILabNavigationBar(mainPage, webViewPage);
  return [mainPage, webViewPage, aiLabNavigationBar];
}
