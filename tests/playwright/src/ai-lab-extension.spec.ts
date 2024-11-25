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
import type { NavigationBar, ExtensionsPage } from '@podman-desktop/tests-playwright';
import {
  expect as playExpect,
  test,
  RunnerOptions,
  isLinux,
  isWindows,
  waitForPodmanMachineStartup,
} from '@podman-desktop/tests-playwright';
import { AILabPage } from './model/ai-lab-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';
import { AILabExtensionDetailsPage } from './model/podman-extension-ai-lab-details-page';
import type { AILabCatalogPage } from './model/ai-lab-catalog-page';
import { handleWebview } from './utils/webviewHandler';

const AI_LAB_EXTENSION_OCI_IMAGE =
  process.env.EXTENSION_OCI_IMAGE ?? 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_EXTENSION_PREINSTALLED: boolean = process.env.EXTENSION_PREINSTALLED === 'true';
const AI_LAB_CATALOG_EXTENSION_LABEL: string = 'redhat.ai-lab';
const AI_LAB_CATALOG_EXTENSION_NAME: string = 'Podman AI Lab extension';
const AI_LAB_CATALOG_STATUS_ACTIVE: string = 'ACTIVE';

let webview: Page;
let aiLabPage: AILabPage;
const runnerOptions = {
  customFolder: 'ai-lab-tests-pd',
  aiLabModelUploadDisabled: isWindows ? true : false,
};

test.use({
  runnerOptions: new RunnerOptions(runnerOptions),
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
      test.skip(AI_LAB_EXTENSION_PREINSTALLED, 'AI Lab extension is preinstalled');
      await extensionsPage.installExtensionFromOCIImage(AI_LAB_EXTENSION_OCI_IMAGE);
    });
    test('Extension (card) is installed, present and active', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      await playExpect
        .poll(async () => await extensions.extensionIsInstalled(AI_LAB_CATALOG_EXTENSION_LABEL), { timeout: 30000 })
        .toBeTruthy();
      const extensionCard = await extensions.getInstalledExtension(
        AI_LAB_CATALOG_EXTENSION_NAME,
        AI_LAB_CATALOG_EXTENSION_LABEL,
      );
      await playExpect(extensionCard.status).toHaveText(AI_LAB_CATALOG_STATUS_ACTIVE);
    });
    test(`Extension's details show correct status, no error`, async ({ page, navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      const extensionCard = await extensions.getInstalledExtension('ai-lab', AI_LAB_CATALOG_EXTENSION_LABEL);
      await extensionCard.openExtensionDetails(AI_LAB_CATALOG_EXTENSION_NAME);
      const details = new AILabExtensionDetailsPage(page);
      await playExpect(details.heading).toBeVisible();
      await playExpect(details.status).toHaveText(AI_LAB_CATALOG_STATUS_ACTIVE);
      const errorTab = details.tabs.getByRole('button', { name: 'Error' });
      // we would like to propagate the error's stack trace into test failure message
      let stackTrace = '';
      if ((await errorTab.count()) > 0) {
        await details.activateTab('Error');
        stackTrace = await details.errorStackTrace.innerText();
      }
      await playExpect(errorTab, `Error Tab was present with stackTrace: ${stackTrace}`).not.toBeVisible();
    });
    test(`Verify AI Lab extension is installed`, async ({ runner, page, navigationBar }) => {
      [page, webview] = await handleWebview(runner, page, navigationBar);
      aiLabPage = new AILabPage(page, webview);
      await aiLabPage.navigationBar.waitForLoad();
    });
  });

  ['ggerganov/whisper.cpp', 'facebook/detr-resnet-101'].forEach(modelName => {
    test.describe.serial(`Model download and deletion`, () => {
      let catalogPage: AILabCatalogPage;

      test.beforeEach(`Open AI Lab Catalog`, async ({ runner, page, navigationBar }) => {
        [page, webview] = await handleWebview(runner, page, navigationBar);
        aiLabPage = new AILabPage(page, webview);
        await aiLabPage.navigationBar.waitForLoad();

        catalogPage = await aiLabPage.navigationBar.openCatalog();
        await catalogPage.waitForLoad();
      });

      test(`Download ${modelName} model`, async () => {
        test.setTimeout(310_000);
        playExpect(await catalogPage.isModelDownloaded(modelName)).toBeFalsy();
        await catalogPage.downloadModel(modelName);
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await waitForCatalogModel(modelName), { timeout: 300_000, intervals: [5_000] })
          .toBeTruthy();
      });

      test(`Delete ${modelName} model`, async () => {
        test.skip(isWindows, 'Model deletion is currently very buggy in azure cicd');
        test.setTimeout(310_000);
        playExpect(await catalogPage.isModelDownloaded(modelName)).toBeTruthy();
        await catalogPage.deleteModel(modelName);
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await waitForCatalogModel(modelName), { timeout: 300_000, intervals: [2_500] })
          .toBeFalsy();
      });
    });
  });

  ['Audio to Text', 'ChatBot', 'Summarizer', 'Code Generation'].forEach(appName => {
    test.describe.serial(`AI Recipe installation`, () => {
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

async function waitForCatalogModel(modelName: string): Promise<boolean> {
  const recipeCatalogOage = await aiLabPage.navigationBar.openRecipesCatalog();
  await recipeCatalogOage.waitForLoad();

  const catalogPage = await aiLabPage.navigationBar.openCatalog();
  await catalogPage.waitForLoad();

  return await catalogPage.isModelDownloaded(modelName);
}
