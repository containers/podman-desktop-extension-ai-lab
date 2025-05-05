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
import type { Runner, NavigationBar } from '@podman-desktop/tests-playwright';
import { expect as playExpect, podmanAILabExtension } from '@podman-desktop/tests-playwright';
import { AILabPage } from 'src/model/ai-lab-page';
import { handleWebview } from './webviewHandler';
import { ExtensionAILabPreferencesPage } from 'src/model/preferences-extension-ai-lab-page';
import { AILabExtensionDetailsPage } from 'src/model/podman-extension-ai-lab-details-page';

export async function openAILabDashboard(runner: Runner, page: Page, navigationBar: NavigationBar): Promise<AILabPage> {
  const extensions = await navigationBar.openExtensions();
  const extensionCard = await extensions.getInstalledExtension('ai-lab', AILabPage.AI_LAB_CATALOG_EXTENSION_LABEL);
  await extensionCard.openExtensionDetails(AILabPage.AI_LAB_CATALOG_EXTENSION_NAME);
  const [locPage, webview] = await handleWebview(runner, page, navigationBar);
  const aiLabPage = new AILabPage(locPage, webview);
  await aiLabPage.navigationBar.waitForLoad();
  return aiLabPage;
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
  await settingsBar.getPreferencesLinkLocator('Extension: AI Lab').click();
  const aiLabPreferencesPage = new ExtensionAILabPreferencesPage(page);
  await aiLabPreferencesPage.waitForLoad();
  return aiLabPreferencesPage;
}

export async function openAILabExtensionDetails(
  page: Page,
  navigationBar: NavigationBar,
): Promise<AILabExtensionDetailsPage> {
  const extensions = await navigationBar.openExtensions();
  const extensionCard = await extensions.getInstalledExtension(
    podmanAILabExtension.extensionLabel,
    podmanAILabExtension.extensionFullLabel,
  );
  await extensionCard.openExtensionDetails(podmanAILabExtension.extensionFullName);
  const extensionDetailsPage = new AILabExtensionDetailsPage(page);
  return extensionDetailsPage;
}
