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
import type { NavigationBar, ExtensionsPage, Runner } from '@podman-desktop/tests-playwright';
import {
  expect as playExpect,
  test,
  RunnerOptions,
  isLinux,
  waitForPodmanMachineStartup,
} from '@podman-desktop/tests-playwright';
import { AILabPage } from './model/ai-lab-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';

const AI_LAB_EXTENSION_OCI_IMAGE = 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_CATALOG_EXTENSION_LABEL: string = 'redhat.ai-lab';
const AI_LAB_NAVBAR_EXTENSION_LABEL: string = 'AI Lab';
const AI_LAB_PAGE_BODY_LABEL: string = 'Webview AI Lab';

let webview: Page;
let aiLabPage: AILabPage;

test.use({
  runnerOptions: new RunnerOptions({ customFolder: 'ai-lab-tests-pd', customOutputFolder: 'output' }),
});
test.beforeAll(async ({ runner, welcomePage, page }) => {
  runner.setVideoAndTraceName('ai-lab-e2e');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(120_000);
  await cleanupServiceModels();
  await runner.close();
});

test.describe.serial(`AI Lab extension installation and verification`, { tag: '@smoke' }, () => {
  test.describe.serial(`AI Lab extension installation`, () => {
    let extensionsPage: ExtensionsPage;

    test(`Open Settings -> Extensions page`, async ({ navigationBar }) => {
      const dashboardPage = await navigationBar.openDashboard();
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

  ['ChatBot', 'Summarizer', 'Code Generation', 'RAG Chatbot', 'Audio to Text', 'Object Detection'].forEach(appName => {
    test.describe.serial(`AI Lab extension verification`, () => {
      let recipesCatalogPage: AILabRecipesCatalogPage;

      test.skip(isLinux, `Skipping AI App deployment on Linux`);
      test.beforeEach(`Open Recipes Catalog`, async ({ runner, page, navigationBar }) => {
        [page, webview] = await handleWebview(runner, page, navigationBar);
        aiLabPage = new AILabPage(page, webview);
        await aiLabPage.navigationBar.waitForLoad();

        recipesCatalogPage = await aiLabPage.navigationBar.openRecipesCatalog();
        await recipesCatalogPage.waitForLoad();
      });

      test(`Install ${appName} example app`, async () => {
        test.setTimeout(1_500_000);
        const demoApp = await recipesCatalogPage.openRecipesCatalogApp(appName);
        await demoApp.waitForLoad();
        await demoApp.startNewDeployment();
      });

      test.afterEach(`Stop ${appName} app`, async ({ navigationBar }) => {
        test.setTimeout(150_000);
        await stopAndDeleteApp(appName);
        await cleanupServiceModels();
        await deleteUnusedImages(navigationBar);
      });
    });
  });
});

async function cleanupServiceModels(): Promise<void> {
  try {
    const modelServicePage = await aiLabPage.navigationBar.openServices();
    await modelServicePage.waitForLoad();
    await modelServicePage.deleteAllCurrentModels();
    await playExpect.poll(async () => await modelServicePage.getCurrentModelCount(), { timeout: 60_000 }).toBe(0);
  } catch (error) {
    console.log(`Error while cleaning up service models: ${error}`);
  }
}

async function stopAndDeleteApp(appName: string): Promise<void> {
  const aiRunningAppsPage = await aiLabPage.navigationBar.openRunningApps();
  await aiRunningAppsPage.waitForLoad();
  await playExpect.poll(async () => await aiRunningAppsPage.appExists(appName), { timeout: 10_000 }).toBeTruthy();
  await playExpect
    .poll(async () => await aiRunningAppsPage.getCurrentStatusForApp(appName), { timeout: 60_000 })
    .toBe('RUNNING');
  await aiRunningAppsPage.stopApp(appName);
  await playExpect
    .poll(async () => await aiRunningAppsPage.getCurrentStatusForApp(appName), { timeout: 60_000 })
    .toBe('UNKNOWN');
  await aiRunningAppsPage.deleteAIApp(appName);
  await playExpect.poll(async () => await aiRunningAppsPage.appExists(appName), { timeout: 60_000 }).toBeFalsy();
}

async function deleteUnusedImages(navigationBar: NavigationBar): Promise<void> {
  const imagesPage = await navigationBar.openImages();
  await playExpect(imagesPage.heading).toBeVisible();

  await imagesPage.deleteAllUnusedImages();
  await playExpect.poll(async () => await imagesPage.getCountOfImagesByStatus('UNUSED'), { timeout: 60_000 }).toBe(0);
}

async function handleWebview(runner: Runner, page: Page, navigationBar: NavigationBar): Promise<[Page, Page]> {
  const aiLabPodmanExtensionButton = navigationBar.navigationLocator.getByRole('link', {
    name: AI_LAB_NAVBAR_EXTENSION_LABEL,
  });
  await playExpect(aiLabPodmanExtensionButton).toBeEnabled();
  await aiLabPodmanExtensionButton.click();
  await page.waitForTimeout(2_000);

  const webView = page.getByRole('document', { name: AI_LAB_PAGE_BODY_LABEL });
  await playExpect(webView).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const [mainPage, webViewPage] = runner.getElectronApp().windows();
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
