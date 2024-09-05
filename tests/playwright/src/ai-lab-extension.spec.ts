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
import type { DashboardPage, ExtensionsPage, Runner } from '@podman-desktop/tests-playwright';
import {
  NavigationBar,
  expect as playExpect,
  test,
  RunnerOptions,
  waitForPodmanMachineStartup,
} from '@podman-desktop/tests-playwright';
import { AILabPage } from './model/ai-lab-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';
import type { AILabAppDetailsPage } from './model/ai-lab-app-details-page';
import * as os from 'node:os';

const AI_LAB_EXTENSION_OCI_IMAGE: string =
  process.env.AI_LAB_OCI ?? 'quay.io/rh-ee-astefani/demo-ai-lab:debug-wsl-upload-disabled-1725025190';
const AI_LAB_CATALOG_EXTENSION_LABEL: string = 'redhat.ai-lab';
const AI_LAB_NAVBAR_EXTENSION_LABEL: string = 'AI Lab';
const AI_LAB_PAGE_BODY_LABEL: string = 'Webview AI Lab';
const AI_LAB_AI_APP_NAME: string = 'ChatBot';
const isWindows = os.platform() === 'win32';
const isCI = process.env.AI_LAB_CI_RUN;
const customSettingsPodmanPath = isWindows
  ? `${process.env.USERPROFILE}\\tools\\podman\\podman-5.2.0\\usr\\bin\\podman.exe`
  : '/usr/bin/podman'; //todo: need to get podman path for linux and mac

let webview: Page;
let aiLabPage: AILabPage;
let recipesCatalogPage: AILabRecipesCatalogPage;

let navigationBar: NavigationBar;
let dashboardPage: DashboardPage;
let extensionsPage: ExtensionsPage;

test.use({
  runnerOptions: new RunnerOptions({
    customFolder: 'ai-lab-e2e',
    autoCheckUpdates: false,
    autoUpdate: false,
    extesionsDisabled: [
      'podman-desktop.compose',
      'podman-desktop.docker',
      'podman-desktop.kind',
      'podman-desktop.kube-context',
      'podman-desktop.kubectl-cli',
      'podman-desktop.registries',
      'podman-desktop.lima',
    ],
    binaryPath: isCI ? customSettingsPodmanPath : undefined,
  }),
});
test.beforeAll(async ({ runner, welcomePage, page }) => {
  runner.setVideoAndTraceName('ai-lab-e2e');

  await welcomePage.handleWelcomePage(true);
  navigationBar = new NavigationBar(page);
  await waitForPodmanMachineStartup(page);
  await runner.screenshot('ai-lab-tests-dashboard-podman-machine.png');
});

test.afterAll(async ({ runner }) => {
  await runner.close();
});

test.describe.serial(`AI Lab extension installation and verification`, () => {
  test.describe.serial(`AI Lab extension installation`, () => {
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
    test(`Verify AI Lab is responsive`, async ({ runner, page }) => {
      [page, webview] = await handleWebview(runner, page);
      aiLabPage = new AILabPage(page, webview);
      await aiLabPage.waitForLoad();
    });
  });
  test.describe.serial(`AI Lab extension verification`, () => {
    test.skip(os.platform() === 'linux', `Skipping AI App deployment on Linux`);
    test(`Open Recipes Catalog`, async () => {
      recipesCatalogPage = await aiLabPage.navigationBar.openRecipesCatalog();
      await recipesCatalogPage.waitForLoad();
    });
    test(`Install ChatBot example app`, async () => {
      test.setTimeout(780_000);
      const chatBotApp: AILabAppDetailsPage = await recipesCatalogPage.openRecipesCatalogApp(
        recipesCatalogPage.recipesCatalogNaturalLanguageProcessing,
        AI_LAB_AI_APP_NAME,
      );
      await chatBotApp.waitForLoad();
      await chatBotApp.startNewDeployment(720_000);
    });
  });
});

async function handleWebview(runner: Runner, page: Page): Promise<[Page, Page]> {
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
