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
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { DashboardPage, ExtensionsPage, RunnerTestContext } from '@podman-desktop/tests-playwright';
import { NavigationBar, WelcomePage, PodmanDesktopRunner } from '@podman-desktop/tests-playwright';
import { AILabPage } from './model/ai-lab-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';
import type { AILabAppDetailsPage } from './model/ai-lab-app-details-page';

const AI_LAB_EXTENSION_OCI_IMAGE: string =
  process.env.AI_LAB_OCI ?? 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_CATALOG_EXTENSION_LABEL: string = 'redhat.ai-lab';
const AI_LAB_NAVBAR_EXTENSION_LABEL: string = 'AI Lab';
const AI_LAB_PAGE_BODY_LABEL: string = 'Webview AI Lab';
const AI_LAB_AI_APP_NAME: string = 'ChatBot';

let pdRunner: PodmanDesktopRunner;
let page: Page;
let webview: Page;
let aiLabPage: AILabPage;
let recipesCatalogPage: AILabRecipesCatalogPage;

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
        .poll(async () => await extensionsPage.extensionIsInstalled(AI_LAB_CATALOG_EXTENSION_LABEL), {
          timeout: 30_000,
        })
        .toBeTruthy();
    });
  });
  describe(`AI Lab extension verification`, async () => {
    test(`Verify AI Lab is responsive`, async () => {
      [page, webview] = await handleWebview();
      aiLabPage = new AILabPage(page, webview);
      await aiLabPage.waitForLoad();
    });
    test(`Open Recipes Catalog`, async () => {
      recipesCatalogPage = await aiLabPage.navigationBar.openRecipesCatalog();
      await recipesCatalogPage.waitForLoad();
    });
    test(`Install ChatBot example app`, { timeout: 780_000 }, async () => {
      const chatBotApp: AILabAppDetailsPage = await recipesCatalogPage.openRecipesCatalogApp(
        recipesCatalogPage.recipesCatalogNaturalLanguageProcessing,
        AI_LAB_AI_APP_NAME,
      );
      await chatBotApp.waitForLoad();
      await chatBotApp.startNewDeployment();
    });
  });
});

async function handleWebview(): Promise<[Page, Page]> {
  const aiLabPodmanExtensionButton = navigationBar.navigationLocator.getByRole('link', {
    name: AI_LAB_NAVBAR_EXTENSION_LABEL,
  });
  await playExpect(aiLabPodmanExtensionButton).toBeEnabled();
  await aiLabPodmanExtensionButton.click();
  await page.waitForTimeout(2_000);

  const webView = page.getByRole('document', { name: AI_LAB_PAGE_BODY_LABEL });
  await playExpect(webView).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const [mainPage, webViewPage] = pdRunner.getElectronApp().windows();
  await mainPage.evaluate(() => {
    const element = document.querySelector('webview');
    if (element) {
      (element as HTMLElement).focus();
    } else {
      console.log(`element is null`);
    }
  });

  return [mainPage, webViewPage];
}
