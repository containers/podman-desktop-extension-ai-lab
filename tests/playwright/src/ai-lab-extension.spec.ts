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
import { expect as playExpect } from '@playwright/test';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { DashboardPage, ExtensionsPage, RunnerTestContext } from '@podman-desktop/tests-playwright';
import { NavigationBar, WelcomePage, PodmanDesktopRunner } from '@podman-desktop/tests-playwright';

const AI_LAB_EXTENSION_OCI_IMAGE: string = 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_CATALOG_EXTENSION_LABEL: string = 'redhat.ai-lab';
const AI_LAB_NAVBAR_EXTENSION_LABEL: string = 'AI Lab';
const AI_LAB_PAGE_BODY_LABEL: string = 'Webview AI Lab';

let pdRunner: PodmanDesktopRunner;
let page: Page;

let navigationBar: NavigationBar;
let dashboardPage: DashboardPage;
let extensionsPage: ExtensionsPage;

beforeAll(async () => {
  pdRunner = new PodmanDesktopRunner({ customFolder: 'ai-lab-tests-pd', autoUpdate: false, autoCheckUpdate: false });
  page = await pdRunner.start();
  pdRunner.setVideoAndTraceName('ai-lab-e2e');

  await new WelcomePage(page).handleWelcomePage(true);
  navigationBar = new NavigationBar(page);
});

beforeEach<RunnerTestContext>(async ctx => {
  ctx.pdRunner = pdRunner;
});

afterAll(async () => {
  await pdRunner.close();
});

describe(`AI Lab extension installation and verification`, async () => {
  describe(`AI Lab extension installation`, async () => {
    test(`Open Settings -> Extensions page`, async () => {
      dashboardPage = await navigationBar.openDashboard();
      await playExpect(dashboardPage.mainPage).toBeVisible();
      extensionsPage = await navigationBar.openExtensions();
      await playExpect(extensionsPage.header).toBeVisible();
    });
    test(`Install AI Lab extension`, async () => {
      await extensionsPage.installExtensionFromOCIImage(AI_LAB_EXTENSION_OCI_IMAGE);
      await playExpect
        .poll(async () => await extensionsPage.extensionIsInstalled(AI_LAB_CATALOG_EXTENSION_LABEL), { timeout: 30000 })
        .toBeTruthy();
    });
  });
  describe(`AI Lab extension verification`, async () => {
    test(`Verify AI Lab is present in notification bar and open it`, async () => {
      const aiLabNavBarItem: Locator = navigationBar.navigationLocator.getByLabel(AI_LAB_NAVBAR_EXTENSION_LABEL);
      await playExpect(aiLabNavBarItem).toBeVisible();
      await aiLabNavBarItem.click();
    });
    test(`Verify AI Lab is running`, async () => {
      const aiLabWebview: Locator = page.getByLabel(AI_LAB_PAGE_BODY_LABEL);
      await playExpect(aiLabWebview).toBeVisible();
    });
  });
});
