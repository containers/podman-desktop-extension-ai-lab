/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import type { Locator } from '@playwright/test';
import type { NavigationBar, ExtensionsPage } from '@podman-desktop/tests-playwright';
import {
  expect as playExpect,
  test,
  RunnerOptions,
  isWindows,
  waitForPodmanMachineStartup,
  isLinux,
} from '@podman-desktop/tests-playwright';
import type { AILabDashboardPage } from './model/ai-lab-dashboard-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';
import type { AILabCatalogPage } from './model/ai-lab-catalog-page';
import type { AILabServiceDetailsPage } from './model/ai-lab-service-details-page';
import type { AILabPlaygroundsPage } from './model/ai-lab-playgrounds-page';
import type { AILabPlaygroundDetailsPage } from './model/ai-lab-playground-details-page';
import {
  getExtensionCard,
  getExtensionVersion,
  openAILabExtensionDetails,
  reopenAILabDashboard,
  waitForExtensionToInitialize,
} from './utils/aiLabHandler';

const AI_LAB_EXTENSION_OCI_IMAGE =
  process.env.EXTENSION_OCI_IMAGE ?? 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_EXTENSION_PREINSTALLED: boolean = process.env.EXTENSION_PREINSTALLED === 'true';
const AI_LAB_CATALOG_STATUS_ACTIVE: string = 'ACTIVE';

let aiLabPage: AILabDashboardPage;
const runnerOptions = {
  customFolder: 'ai-lab-tests-pd',
  aiLabModelUploadDisabled: isWindows ? true : false,
};

test.use({
  runnerOptions: new RunnerOptions(runnerOptions),
});
test.beforeAll(async ({ runner, welcomePage, page }) => {
  const window = await runner.getElectronApp().firstWindow();
  // Increase Window Size to improve video recording and screenshots
  await window.setViewportSize({ width: 1050, height: 700 });

  runner.setVideoAndTraceName('ai-lab-e2e');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(120_000);
  await cleanupServiceModels();
  await runner.close();
});

test.describe.serial(`AI Lab extension installation and verification`, () => {
  test.describe.serial(`AI Lab extension installation`, { tag: '@smoke' }, () => {
    let extensionsPage: ExtensionsPage;

    test(`Open Settings -> Extensions page`, async ({ navigationBar }) => {
      const dashboardPage = await navigationBar.openDashboard();
      await playExpect(dashboardPage.mainPage).toBeVisible();
      extensionsPage = await navigationBar.openExtensions();
      await playExpect(extensionsPage.header).toBeVisible();
    });

    test(`Install AI Lab extension`, async () => {
      test.skip(AI_LAB_EXTENSION_PREINSTALLED, 'AI Lab extension is preinstalled');
      test.setTimeout(120_000);
      await extensionsPage.installExtensionFromOCIImage(AI_LAB_EXTENSION_OCI_IMAGE);
    });

    test('Extension (card) is installed, present and active', async ({ navigationBar }) => {
      await waitForExtensionToInitialize(navigationBar);
      const extensionCard = await getExtensionCard(navigationBar);
      await playExpect(extensionCard.status).toHaveText(AI_LAB_CATALOG_STATUS_ACTIVE);
    });

    test(`Extension's details show correct status, no error`, async ({ navigationBar }) => {
      const aiLabExtensionDetailsPage = await openAILabExtensionDetails(navigationBar);
      await aiLabExtensionDetailsPage.waitForLoad();
      await aiLabExtensionDetailsPage.checkIsActive(AI_LAB_CATALOG_STATUS_ACTIVE);
      await aiLabExtensionDetailsPage.checkForErrors();
    });

    test(`Verify AI Lab is accessible`, async ({ runner, page, navigationBar }) => {
      aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
      await aiLabPage.navigationBar.waitForLoad();
    });
  });

  test.describe.serial('AI Lab API endpoint e2e test', { tag: '@smoke' }, () => {
    let localServerPort: string;
    let extensionVersion: string | undefined;
    const model: string = 'facebook/detr-resnet-101';
    test.beforeAll(
      'Get AI Lab extension version and open AI Lab navigation bar',
      async ({ page, runner, navigationBar }) => {
        extensionVersion = await getExtensionVersion(navigationBar);
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await aiLabPage.navigationBar.waitForLoad();
      },
    );

    test('Retrieve local server dynamic port and verify server response', async () => {
      const localServerPage = await aiLabPage.navigationBar.openLocalServer();
      await localServerPage.waitForLoad();
      localServerPort = await localServerPage.getLocalServerPort();

      const response: Response = await fetch(`http://127.0.0.1:${localServerPort}/`, { cache: 'no-store' });
      const blob: Blob = await response.blob();
      const text: string = await blob.text();
      playExpect(text).toContain('OK');
    });

    test('Fetch API Version', async ({ request }) => {
      const response = await request.get(`http://127.0.0.1:${localServerPort}/api/version`, {
        headers: {
          Accept: 'application/json',
        },
      });
      playExpect(response.ok()).toBeTruthy();
      const apiResponse = await response.json();

      console.log(`API version: ${apiResponse.version}`);
      playExpect(apiResponse.version).toBe(extensionVersion);
    });

    test(`Download ${model} via API`, async ({ request }) => {
      test.setTimeout(300_000);
      const catalogPage = await aiLabPage.navigationBar.openCatalog();
      await catalogPage.waitForLoad();
      console.log(`Downloading ${model}...`);
      const response = await request.post(`http://127.0.0.1:${localServerPort}/api/pull`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        data: {
          model: model,
          insecure: false,
          stream: true,
        },
        timeout: 300_000,
      });

      const body = await response.body();
      const text = body.toString();
      playExpect(text).toContain('success');
    });

    // This test is currently failing due to a known issue: https://github.com/containers/podman-desktop-extension-ai-lab/issues/2925
    test.fail(`Verify ${model} is available in AI Lab Catalog`, async () => {
      const catalogPage = await aiLabPage.navigationBar.openCatalog();
      await catalogPage.waitForLoad();
      await playExpect
        // eslint-disable-next-line sonarjs/no-nested-functions
        .poll(async () => await waitForCatalogModel(model))
        .toBeTruthy();
    });

    // This test is currently failing due to a known issue: https://github.com/containers/podman-desktop-extension-ai-lab/issues/2925
    test.fail(`Verify ${model} is listed in models fetched from API`, async ({ request }) => {
      const response = await request.get(`http://127.0.0.1:${localServerPort}/api/tags`, {
        headers: {
          Accept: 'application/json',
        },
      });
      playExpect(response.ok()).toBeTruthy();
      const parsedJson = await response.json();
      console.log(parsedJson);
      playExpect(parsedJson.models.length).not.toBe(0);
      playExpect(parsedJson.models).toContain(model);
    });

    // This test is currently failing due to a known issue: https://github.com/containers/podman-desktop-extension-ai-lab/issues/2925
    test.fail(`Delete ${model} model`, async () => {
      test.skip(isWindows, 'Model deletion is currently very buggy in azure cicd');
      test.setTimeout(310_000);
      const catalogPage = await aiLabPage.navigationBar.openCatalog();
      await catalogPage.waitForLoad();
      playExpect(await catalogPage.isModelDownloaded(model)).toBeTruthy();
      await catalogPage.deleteModel(model);
      await playExpect
        // eslint-disable-next-line sonarjs/no-nested-functions
        .poll(async () => await waitForCatalogModel(model))
        .toBeFalsy();
    });
  });

  ['ggerganov/whisper.cpp', 'facebook/detr-resnet-101'].forEach(modelName => {
    test.describe.serial(`Model download and deletion`, { tag: '@smoke' }, () => {
      let catalogPage: AILabCatalogPage;

      test.beforeEach(`Open AI Lab Catalog`, async ({ runner, page, navigationBar }) => {
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await aiLabPage.navigationBar.waitForLoad();

        catalogPage = await aiLabPage.navigationBar.openCatalog();
        await catalogPage.waitForLoad();
      });

      test(`Download ${modelName} model`, async () => {
        test.setTimeout(310_000);
        if (!(await catalogPage.isModelDownloaded(modelName))) {
          await catalogPage.downloadModel(modelName);
        }
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

  ['ggerganov/whisper.cpp', 'instructlab/granite-7b-lab-GGUF'].forEach(modelName => {
    test.describe.serial(`Model service creation and deletion`, { tag: '@smoke' }, () => {
      let catalogPage: AILabCatalogPage;
      let modelServiceDetailsPage: AILabServiceDetailsPage;

      test.skip(
        isLinux && modelName === 'instructlab/granite-7b-lab-GGUF',
        `Skipping ${modelName} model service creation on linux due to known issue`,
      );

      test.beforeAll(`Open AI Lab Catalog`, async ({ runner, page, navigationBar }) => {
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await aiLabPage.navigationBar.waitForLoad();

        catalogPage = await aiLabPage.navigationBar.openCatalog();
        await catalogPage.waitForLoad();
      });

      test(`Download ${modelName} model if not available`, async () => {
        test.setTimeout(610_000);
        if (!(await catalogPage.isModelDownloaded(modelName))) {
          await catalogPage.downloadModel(modelName);
        }
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await waitForCatalogModel(modelName), { timeout: 600_000, intervals: [5_000] })
          .toBeTruthy();
      });

      test(`Create model service from catalog for ${modelName}`, async () => {
        test.setTimeout(310_000);
        const modelServiceCreationPage = await catalogPage.createModelService(modelName);
        await modelServiceCreationPage.waitForLoad();

        modelServiceDetailsPage = await modelServiceCreationPage.createService();
        await modelServiceDetailsPage.waitForLoad();

        await playExpect(modelServiceDetailsPage.modelName).toContainText(modelName);
        await playExpect(modelServiceDetailsPage.inferenceServerType).toContainText('Inference');
        await playExpect(modelServiceDetailsPage.inferenceServerType).toContainText(/CPU|GPU/);
      });

      test(`Make GET request to the model service for ${modelName}`, async ({ request }) => {
        test.skip(modelName === 'instructlab/granite-7b-lab-GGUF', `Skipping GET request for ${modelName}`);

        const port = await modelServiceDetailsPage.getInferenceServerPort();
        const url = `http://localhost:${port}`;

        // eslint-disable-next-line sonarjs/no-nested-functions
        await playExpect(async () => {
          const response = await request.get(url);
          playExpect(response.ok()).toBeTruthy();
        }).toPass({ timeout: 30_000 });
      });

      test(`Make POST request to the model service for ${modelName}`, async ({ request }) => {
        test.skip(modelName === 'ggerganov/whisper.cpp', `Skipping POST request for ${modelName}`);
        test.setTimeout(610_000);

        const port = await modelServiceDetailsPage.getInferenceServerPort();
        const url = `http://localhost:${port}/v1/chat/completions`;

        // eslint-disable-next-line sonarjs/no-nested-functions
        await playExpect(async () => {
          const response = await request.post(url, {
            data: {
              messages: [
                {
                  content: 'You are a helpful assistant.',
                  role: 'system',
                },
                {
                  content: 'What is the capital of Spain?',
                  role: 'user',
                },
              ],
            },
          });
          playExpect(response.ok()).toBeTruthy();
          playExpect(await response.text()).toContain('Madrid');
        }).toPass({ timeout: 600_000, intervals: [5_000] });
      });

      test(`Restart model service for ${modelName}`, async () => {
        test.skip(modelName === 'ggerganov/whisper.cpp');
        test.setTimeout(180_000);

        await modelServiceDetailsPage.stopService();
        await playExpect(modelServiceDetailsPage.startServiceButton).toBeEnabled({ timeout: 120_000 });
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await modelServiceDetailsPage.getServiceState(), { timeout: 120_000 })
          .toBe('');

        await modelServiceDetailsPage.startService();
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await modelServiceDetailsPage.getServiceState(), { timeout: 120_000 })
          .toBe('RUNNING');
      });

      test(`Delete model service for ${modelName}`, async () => {
        test.setTimeout(150_000);
        const modelServicePage = await modelServiceDetailsPage.deleteService();
        await playExpect(modelServicePage.heading).toBeVisible({ timeout: 120_000 });
      });
    });
  });

  ['lmstudio-community/granite-3.0-8b-instruct-GGUF'].forEach(modelName => {
    test.describe.serial(`AI Lab playground creation and deletion`, () => {
      let catalogPage: AILabCatalogPage;
      let playgroundsPage: AILabPlaygroundsPage;
      let playgroundDetailsPage: AILabPlaygroundDetailsPage;
      let assistantResponse: Locator;

      const playgroundName = 'test playground';
      const systemPrompt = 'Always respond with: "Hello, I am Chat Bot"';

      test.beforeAll(`Open AI Lab Catalog`, async ({ runner, page, navigationBar }) => {
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await aiLabPage.navigationBar.waitForLoad();

        catalogPage = await aiLabPage.navigationBar.openCatalog();
        await catalogPage.waitForLoad();
      });

      test(`Download ${modelName} model if not available`, async () => {
        test.setTimeout(310_000);
        if (!(await catalogPage.isModelDownloaded(modelName))) {
          await catalogPage.downloadModel(modelName);
        }
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await waitForCatalogModel(modelName), { timeout: 300_000, intervals: [5_000] })
          .toBeTruthy();
      });

      test(`Create AI Lab playground for ${modelName}`, async () => {
        test.setTimeout(310_000);
        playgroundsPage = await aiLabPage.navigationBar.openPlaygrounds();
        await playgroundsPage.waitForLoad();

        await playgroundsPage.createNewPlayground(playgroundName);
        await playgroundsPage.waitForLoad();
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await playgroundsPage.doesPlaygroundExist(playgroundName), { timeout: 60_000 })
          .toBeTruthy();
      });

      test(`Go to AI Lab playground details for ${modelName}`, async () => {
        playgroundDetailsPage = await playgroundsPage.goToPlaygroundDetails(playgroundName);
        await playgroundDetailsPage.waitForLoad();

        await playExpect(playgroundDetailsPage.conversationSectionLocator).toBeVisible();
        await playExpect(playgroundDetailsPage.temperatureSliderLocator).toBeVisible();
        await playExpect(playgroundDetailsPage.maxTokensSliderLocator).toBeVisible();
        await playExpect(playgroundDetailsPage.topPSliderLocator).toBeVisible();
        await playExpect(playgroundDetailsPage.deletePlaygroundButton).toBeEnabled();
      });

      test('Set system prompt, submit user input, and verify assistant response is visible', async () => {
        test.setTimeout(100_000);
        await playgroundDetailsPage.defineSystemPrompt(systemPrompt);
        await playgroundDetailsPage.submitUserInput('Hello');
        // Get the first assistant response
        assistantResponse = await playgroundDetailsPage.getAssistantResponse(0);
        await playExpect(assistantResponse).toBeVisible();
      });

      test('Verify assistant response contains the expected system prompt', async () => {
        playExpect(await assistantResponse.innerText()).toContain('Hello, I am Chat Bot');
      });

      test(`Delete AI Lab playground for ${modelName}`, async () => {
        test.setTimeout(70_000);
        playgroundsPage = await aiLabPage.navigationBar.openPlaygrounds();
        await playgroundsPage.waitForLoad();

        await playgroundsPage.deletePlayground(playgroundName);

        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await playgroundsPage.doesPlaygroundExist(playgroundName), { timeout: 60_000 })
          .toBeFalsy();
      });

      test.afterAll(`Cleaning up service model`, async () => {
        test.setTimeout(60_000);
        await cleanupServiceModels();
      });
    });
  });

  ['Audio to Text', 'ChatBot', 'Summarizer', 'Code Generation', 'RAG Chatbot', 'Function calling'].forEach(appName => {
    test.describe.serial(`AI Recipe installation`, () => {
      test.skip(
        !process.env.EXT_TEST_RAG_CHATBOT && appName === 'RAG Chatbot',
        'EXT_TEST_RAG_CHATBOT variable not set, skipping test',
      );
      let recipesCatalogPage: AILabRecipesCatalogPage;

      test.beforeAll(`Open Recipes Catalog`, async ({ runner, page, navigationBar }) => {
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
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

      test(`Verify that model service for the ${appName} is working`, async ({ request }) => {
        test.skip(appName !== 'Function calling');
        test.setTimeout(600_000);

        const modelServicePage = await aiLabPage.navigationBar.openServices();
        const serviceDetailsPage = await modelServicePage.openServiceDetails(
          'ibm-granite/granite-3.3-8b-instruct-GGUF',
        );

        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await serviceDetailsPage.getServiceState(), { timeout: 60_000 })
          .toBe('RUNNING');
        const port = await serviceDetailsPage.getInferenceServerPort();
        const url = `http://localhost:${port}/v1/chat/completions`;

        const response = await request.post(url, {
          data: {
            messages: [
              {
                content: 'You are a helpful assistant.',
                role: 'system',
              },
              {
                content: 'What is the capital of Czech Republic?',
                role: 'user',
              },
            ],
          },
          timeout: 600_000,
        });

        playExpect(response.ok()).toBeTruthy();
        const body = await response.body();
        const text = body.toString();
        playExpect(text).toContain('Prague');
      });

      test(`${appName}: Restart, Stop, Delete. Clean up model service`, async () => {
        test.setTimeout(150_000);

        await restartApp(appName);
        await stopAndDeleteApp(appName);
        await cleanupServiceModels();
      });

      test.afterAll(`Ensure cleanup of "${appName}" app, related service, and images`, async ({ navigationBar }) => {
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

async function restartApp(appName: string): Promise<void> {
  const aiRunningAppsPage = await aiLabPage.navigationBar.openRunningApps();
  const aiApp = await aiRunningAppsPage.getRowForApp(appName);
  await aiRunningAppsPage.waitForLoad();
  await playExpect.poll(async () => await aiRunningAppsPage.appExists(appName), { timeout: 10_000 }).toBeTruthy();
  await playExpect
    .poll(async () => await aiRunningAppsPage.getCurrentStatusForApp(appName), { timeout: 60_000 })
    .toBe('RUNNING');
  await aiRunningAppsPage.restartApp(appName);

  const appProgressBar = aiApp.getByRole('progressbar', { name: 'Loading' });
  await playExpect(appProgressBar).toBeVisible({ timeout: 40_000 });
  await playExpect
    .poll(async () => await aiRunningAppsPage.getCurrentStatusForApp(appName), { timeout: 60_000 })
    .toBe('RUNNING');
}

async function stopAndDeleteApp(appName: string): Promise<void> {
  const aiRunningAppsPage = await aiLabPage.navigationBar.openRunningApps();
  await aiRunningAppsPage.waitForLoad();
  if (!(await aiRunningAppsPage.appExists(appName))) {
    console.log(`"${appName}" is not present in the running apps list. Skipping stop and delete operations.`);
    return;
  }
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
