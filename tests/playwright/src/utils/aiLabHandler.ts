/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import type { Runner, NavigationBar, ExtensionCardPage } from '@podman-desktop/tests-playwright';
import { expect as playExpect, podmanAILabExtension } from '@podman-desktop/tests-playwright';
import type { AILabDashboardPage } from 'src/model/ai-lab-dashboard-page';
import { handleWebview } from './webviewHandler';
import { ExtensionAILabPreferencesPage } from 'src/model/preferences-extension-ai-lab-page';
import { AILabExtensionDetailsPage } from 'src/model/podman-extension-ai-lab-details-page';

export async function reopenAILabDashboard(
  runner: Runner,
  page: Page,
  navigationBar: NavigationBar,
): Promise<AILabDashboardPage> {
  const dashboardPage = await navigationBar.openDashboard();
  await playExpect(dashboardPage.mainPage).toBeVisible();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars
  const [_locPage, _webview, aiLabNavigationBar] = await handleWebview(runner, page, navigationBar);
  const aiLabDashboardPage = await aiLabNavigationBar.openDashboard();
  await aiLabDashboardPage.waitForLoad();
  return aiLabDashboardPage;
}

export async function openAILabPreferences(
  navigationBar: NavigationBar,
  page: Page,
): Promise<ExtensionAILabPreferencesPage> {
  const dashboardPage = await navigationBar.openDashboard();
  await playExpect(dashboardPage.mainPage).toBeVisible();
  const settingsBar = await navigationBar.openSettings();
  await playExpect(settingsBar.preferencesTab).toBeVisible();
  await settingsBar.expandPreferencesTab();
  await playExpect(settingsBar.preferencesTab).toBeVisible();
  await settingsBar.getPreferencesLinkLocator(ExtensionAILabPreferencesPage.tabName).click();
  const aiLabPreferencesPage = new ExtensionAILabPreferencesPage(page);
  await aiLabPreferencesPage.waitForLoad();
  return aiLabPreferencesPage;
}

export async function openAILabExtensionDetails(navigationBar: NavigationBar): Promise<AILabExtensionDetailsPage> {
  const extensionCard = await getExtensionCard(navigationBar);
  const extensionDetails = await extensionCard.openExtensionDetails(podmanAILabExtension.extensionFullName);
  const aiLabExtensionDetails = new AILabExtensionDetailsPage(extensionDetails.page);
  await aiLabExtensionDetails.waitForLoad();
  return aiLabExtensionDetails;
}

export async function getExtensionCard(navigationBar: NavigationBar): Promise<ExtensionCardPage> {
  const extensions = await navigationBar.openExtensions();
  const extensionCard = await extensions.getInstalledExtension(
    podmanAILabExtension.extensionLabel,
    podmanAILabExtension.extensionFullLabel,
  );
  return extensionCard;
}

export async function waitForExtensionToInitialize(navigationBar: NavigationBar): Promise<void> {
  const extensions = await navigationBar.openExtensions();
  await playExpect
    .poll(async () => await extensions.extensionIsInstalled(podmanAILabExtension.extensionFullLabel), {
      timeout: 30000,
    })
    .toBeTruthy();
}

export async function getExtensionVersion(navigationBar: NavigationBar): Promise<string> {
  const extensionsPage = await navigationBar.openExtensions();
  const extensionVersion = await extensionsPage.getInstalledExtensionVersion(
    podmanAILabExtension.extensionLabel,
    podmanAILabExtension.extensionFullLabel,
  );
  playExpect(extensionVersion, `Extension version could not be retrieved.`).toBeDefined();
  return String(extensionVersion);
}
