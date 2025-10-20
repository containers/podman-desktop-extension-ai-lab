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

/**
 * The 'test-audio-to-text.wav' file used in this test was sourced from the
 * whisper.cpp project (https://github.com/ggml-org/whisper.cpp).
 * It is licensed under the MIT License (see https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE for details).
 * This specific WAV file is used solely for Playwright testing purposes within this repository.
 */

import type { APIResponse, Locator } from '@playwright/test';
import type { NavigationBar, ExtensionsPage } from '@podman-desktop/tests-playwright';
import {
  ContainerDetailsPage,
  ContainerState,
  expect as playExpect,
  test,
  RunnerOptions,
  isWindows,
  waitForPodmanMachineStartup,
  isLinux,
  isMac,
  isCI,
  resetPodmanMachinesFromCLI,
  handleConfirmationDialog,
  podmanAILabExtension,
} from '@podman-desktop/tests-playwright';
import type { AILabDashboardPage } from './model/ai-lab-dashboard-page';
import type { AILabRecipesCatalogPage } from './model/ai-lab-recipes-catalog-page';
import type { AILabCatalogPage } from './model/ai-lab-catalog-page';
import type { AILabPlaygroundsPage } from './model/ai-lab-playgrounds-page';
import type { AILabPlaygroundDetailsPage } from './model/ai-lab-playground-details-page';
import {
  getExtensionCard,
  getExtensionVersion,
  openAILabExtensionDetails,
  openAILabPreferences,
  reopenAILabDashboard,
  waitForExtensionToInitialize,
} from './utils/aiLabHandler';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AILabTryInstructLabPage } from './model/ai-lab-try-instructlab-page';
import type { AiLlamaStackPage } from './model/ai-lab-model-llamastack-page';
import type { ApplicationCatalog } from '../../../packages/shared/src/models/IApplicationCatalog';

const AI_LAB_EXTENSION_OCI_IMAGE =
  process.env.EXTENSION_OCI_IMAGE ?? 'ghcr.io/containers/podman-desktop-extension-ai-lab:nightly';
const AI_LAB_EXTENSION_PREINSTALLED: boolean = process.env.EXTENSION_PREINSTALLED === 'true';
const AI_LAB_CATALOG_STATUS_ACTIVE: string = 'ACTIVE';

let aiLabPage: AILabDashboardPage;
const runnerOptions = {
  customFolder: 'ai-lab-tests-pd',
  aiLabModelUploadDisabled: isWindows ? true : false,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_AUDIO_FILE_PATH: string = path.resolve(
  __dirname,
  '..',
  '..',
  'playwright',
  'resources',
  `test-audio-to-text.wav`,
);
const AI_JSON_FILE_PATH: string = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'backend',
  'src',
  'assets',
  'ai.json',
);

const aiJSONFile = fs.readFileSync(AI_JSON_FILE_PATH, 'utf8');
const AI_JSON: ApplicationCatalog = JSON.parse(aiJSONFile) as ApplicationCatalog;
const AI_APP_MODELS: Set<string> = new Set();
AI_JSON.recipes.forEach(recipe => {
  recipe.recommended?.forEach(model => {
    AI_APP_MODELS.add(model);
  });
});
// Create a set of AI models that are not the first recommended model for any app
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _AI_APP_UNUSED_MODELS: string[] = [
  ...AI_APP_MODELS.values().filter(model => {
    // Check if the model is not the first recommended model for any app
    return !Array.from(AI_JSON.recipes).some(recipe => {
      return recipe.recommended?.at(0) === model;
    });
  }),
];
const AI_APP_MODEL_AND_NAMES: Map<string, string[]> = new Map();
AI_JSON.recipes.forEach(recipe => {
  const recommendedModel = recipe.recommended?.at(0);
  if (recommendedModel) {
    const actualModelName = AI_JSON.models.find(model => model.id === recommendedModel)?.name;
    if (actualModelName) {
      if (!AI_APP_MODEL_AND_NAMES.has(actualModelName)) {
        AI_APP_MODEL_AND_NAMES.set(actualModelName, []);
      }
      AI_APP_MODEL_AND_NAMES.get(actualModelName)?.push(recipe.name);
    }
  }
});

test.use({
  runnerOptions: new RunnerOptions(runnerOptions),
});
test.beforeAll(async ({ runner, welcomePage, page }) => {
  const window = await runner.getElectronApp().firstWindow();
  // Increase Window Size to improve video recording and screenshots
  await window.setViewportSize({ width: 1050, height: 700 });

  runner.setVideoAndTraceName('ai-lab-e2e');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page, 180_000);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(180_000);
  if (isCI) {
    await resetPodmanMachinesFromCLI();
  }
  await runner.close();
});

test.describe.serial(`AI Lab extension installation and verification`, () => {
  test.describe.serial(`AI Lab extension installation`, { tag: ['@smoke', '@instructLab'] }, () => {
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

  test.describe.serial(`AI Lab extension GPU preferences`, { tag: '@smoke' }, () => {
    test(`Verify GPU support banner is visible, preferences are disabled`, async ({ page, navigationBar }) => {
      test.setTimeout(15_000);
      await playExpect(aiLabPage.gpuSupportBanner).toBeVisible();
      await playExpect(aiLabPage.enableGpuButton).toBeVisible();
      await playExpect(aiLabPage.dontDisplayButton).toBeVisible();
      const preferencesPage = await openAILabPreferences(navigationBar, page);
      await preferencesPage.waitForLoad();
      playExpect(await preferencesPage.isGPUPreferenceEnabled()).toBeFalsy();
    });

    test(`Enable GPU support and verify preferences`, async ({ runner, page, navigationBar }) => {
      test.setTimeout(30_000);
      aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
      await aiLabPage.waitForLoad();
      await aiLabPage.enableGpuSupport();
      const preferencesPage = await openAILabPreferences(navigationBar, page);
      await preferencesPage.waitForLoad();
      playExpect(await preferencesPage.isGPUPreferenceEnabled()).toBeTruthy();
    });

    test.afterAll(
      `Disable GPU support, return to AI Lab Dashboard and hide banner`,
      async ({ runner, page, navigationBar }) => {
        test.setTimeout(30_000);
        const preferencesPage = await openAILabPreferences(navigationBar, page);
        await preferencesPage.waitForLoad();
        await preferencesPage.disableGPUPreference();
        playExpect(await preferencesPage.isGPUPreferenceEnabled()).toBeFalsy();
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await playExpect(aiLabPage.gpuSupportBanner).toBeVisible();
        await playExpect(aiLabPage.enableGpuButton).toBeVisible();
        await playExpect(aiLabPage.dontDisplayButton).toBeVisible();
        await aiLabPage.dontDisplayButton.click();
        await playExpect(aiLabPage.gpuSupportBanner).toBeHidden();
      },
    );
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

    // This test is currently failing due to a known issue: https://github.com/containers/podman-desktop-extension-ai-lab/issues/2925
    test.skip(`Download ${model} via API`, async ({ request }) => {
      test.setTimeout(610_000);
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
        timeout: 600_000,
      });

      const body = await response.body();
      const text = body.toString();
      playExpect(text).toContain('success');
      await aiLabPage.navigationBar.openCatalog();
      await catalogPage.waitForLoad();
      await playExpect
        // eslint-disable-next-line sonarjs/no-nested-functions
        .poll(async () => await waitForCatalogModel(model))
        .toBeTruthy();
    });

    // This test is currently failing due to a known issue: https://github.com/containers/podman-desktop-extension-ai-lab/issues/2925
    test.skip(`Verify ${model} is listed in models fetched from API`, async ({ request }) => {
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
    test.skip(`Delete ${model} model`, async () => {
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

  // Do not use non-instruct models in playground tests.
  // They break out of guilderails and fail the tests.
  ['ibm-granite/granite-4.0-micro-GGUF'].forEach(modelName => {
    test.describe.serial(`AI Lab playground creation and deletion for ${modelName}`, { tag: '@smoke' }, () => {
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
        test.setTimeout(610_000);
        if (!(await catalogPage.isModelDownloaded(modelName))) {
          await catalogPage.downloadModel(modelName);
        }
        await playExpect
          // eslint-disable-next-line sonarjs/no-nested-functions
          .poll(async () => await waitForCatalogModel(modelName), { timeout: 600_000, intervals: [5_000] })
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

      test.afterAll(`Cleaning up service model`, async ({ navigationBar }) => {
        test.setTimeout(120_000);
        await cleanupServices();
        await deleteAllModels();
        await deleteUnusedImages(navigationBar);
      });
    });
  });

  AI_APP_MODEL_AND_NAMES.forEach((appNames, appModel) => {
    /* eslint-disable sonarjs/no-nested-functions */
    test.describe.serial(`AI Recipe installation for ${appModel}`, { tag: '@smoke' }, () => {
      appNames.forEach(appName => {
        test.describe.serial(`AI Recipe installation ${appName}`, () => {
          test.skip(
            !process.env.EXT_TEST_RAG_CHATBOT &&
              (appName === 'RAG Chatbot' ||
                appName === 'Node.js RAG Chatbot' ||
                appName === 'Graph RAG Chat Application'),
            'EXT_TEST_RAG_CHATBOT variable not set, skipping test',
          );
          let recipesCatalogPage: AILabRecipesCatalogPage;

          test(`Open Recipes Catalog`, async ({ runner, page, navigationBar }) => {
            aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
            await aiLabPage.navigationBar.waitForLoad();

            recipesCatalogPage = await aiLabPage.navigationBar.openRecipesCatalog();
            await recipesCatalogPage.waitForLoad();
          });

          test.skip(
            appName === 'Audio to Text' && !!isCI && !!isLinux,
            'Audio to Text app is skipped on Linux CI due to stability issues',
          );

          test(`Install ${appName} example app`, async () => {
            test.setTimeout(1_500_000);
            test.skip(
              appName === 'Object Detection' && isCI && !isMac,
              'Currently we are facing issues with the Object Detection app installation on Windows and Linux CI.',
            );
            const demoApp = await recipesCatalogPage.openRecipesCatalogApp(appName);
            await demoApp.waitForLoad();
            await demoApp.startNewDeployment();
          });

          test(`Verify ${appName} app HTTP page is reachable`, async ({ request }) => {
            test.setTimeout(60_000);
            test.skip(
              appName === 'Object Detection' && isCI && !isMac,
              'Currently we are facing issues with the Object Detection app installation on Windows and Linux CI.',
            );
            let response: APIResponse | undefined = undefined;

            switch (appName) {
              case 'Object Detection': {
                const aiRunningAppsPage = await aiLabPage.navigationBar.openRunningApps();
                const appPort = await aiRunningAppsPage.getAppPort(appName);
                response = await request.get(`http://localhost:${appPort}`, { timeout: 60_000 });
                playExpect(response.ok()).toBeTruthy();
                const body = await response.text();
                playExpect(body).toContain('<title>Streamlit</title>');
                break;
              }

              default:
                console.warn(`Unhandled AI App: ${appName}`);
                test.skip(true, 'Test is not implemented yet');
            }
          });

          test(`Verify that model service for the ${appName} is working`, async ({ request }) => {
            test.setTimeout(600_000);
            test.fail(
              appName === 'Audio to Text',
              'Expected failure due to issue #3111: https://github.com/containers/podman-desktop-extension-ai-lab/issues/3111',
            );
            test.skip(
              appName === 'Object Detection' && isCI && !isMac,
              'Currently we are facing issues with the Object Detection app installation on Windows and Linux CI.',
            );

            let port: string = '';
            let baseUrl: string = '';
            let response: APIResponse | undefined = undefined;
            let expectedResponse: string = '';

            switch (appName) {
              case 'Audio to Text': {
                port = await getModelServicePort(appModel);
                baseUrl = `http://localhost:${port}`;
                expectedResponse =
                  'And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country';
                const audioFileContent = fs.readFileSync(TEST_AUDIO_FILE_PATH);

                response = await request.post(`${baseUrl}/inference`, {
                  headers: {
                    Accept: 'application/json',
                  },
                  multipart: {
                    file: {
                      name: 'test.wav',
                      mimeType: 'audio/wav',
                      buffer: audioFileContent,
                    },
                  },
                  timeout: 600_000,
                });
                break;
              }

              case 'Function calling': {
                port = await getModelServicePort(appModel);
                baseUrl = `http://localhost:${port}`;
                expectedResponse = 'Prague';
                response = await request.post(`${baseUrl}/v1/chat/completions`, {
                  data: {
                    messages: [
                      { role: 'system', content: 'You are a helpful assistant.' },
                      { role: 'user', content: 'What is the capital of Czech Republic?' },
                    ],
                  },
                  timeout: 600_000,
                });
                break;
              }

              default:
                console.warn(`Unhandled AI App: ${appName}`);
                test.skip(true, 'Test is not implemented yet');
            }

            if (response) {
              playExpect(response.ok()).toBeTruthy();
              const body = await response?.body();
              const text = body?.toString() ?? '';
              playExpect(text).toContain(expectedResponse);
            }
          });

          test(`${appName}: Restart, Stop, Delete.`, async () => {
            test.setTimeout(240_000);
            test.skip(
              appName === 'Object Detection' && isCI && !isMac,
              'Currently we are facing issues with the Object Detection app installation on Windows and Linux CI.',
            );

            await restartApp(appName);
            await stopAndDeleteApp(appName);
            await cleanupServices();
          });
        });
      });

      test(`Ensure cleanup of "${appModel}", related services, and images`, async ({ runner, page, navigationBar }) => {
        test.setTimeout(180_000);
        aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
        await cleanupServices();
        await deleteAllModels();
        await deleteUnusedImages(navigationBar);
      });
    });
  });

  test.describe.serial('InstructLab container startup', { tag: ['@smoke', '@instructLab'] }, () => {
    let instructLabPage: AILabTryInstructLabPage;
    const instructLabContainerName = /^instructlab-\d+$/;
    let exactInstructLabContainerName = '';

    test.beforeAll('Open Try InstructLab page', async ({ runner, page, navigationBar }) => {
      aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
      await aiLabPage.navigationBar.waitForLoad();

      instructLabPage = await aiLabPage.navigationBar.openTryInstructLab();
      await instructLabPage.waitForLoad();
    });

    test('Start and verify InstructLab container', async ({ page }) => {
      test.setTimeout(1_000_000);
      await playExpect(instructLabPage.startInstructLabButton).toBeVisible();
      await playExpect(instructLabPage.startInstructLabButton).toBeEnabled();
      await instructLabPage.startInstructLabButton.click();

      await playExpect(instructLabPage.openInstructLabButton).toBeVisible({ timeout: 900_000 });
      await playExpect(instructLabPage.openInstructLabButton).toBeEnabled({ timeout: 10_000 });
      await playExpect(instructLabPage.statusMessageBox).toContainText('Starting InstructLab container');

      const checkMarkLocator = instructLabPage.statusMessageBox.locator('[class*="text-green"]');
      await playExpect(checkMarkLocator).toHaveCount(3);
      await instructLabPage.openInstructLabButton.click();

      const containerName = await page
        .getByRole('region', { name: 'Header' })
        .getByLabel(instructLabContainerName)
        .textContent();
      if (typeof containerName === 'string') {
        exactInstructLabContainerName = containerName;
      }
      const containerDetailsPage = new ContainerDetailsPage(page, exactInstructLabContainerName);
      await playExpect(containerDetailsPage.heading).toBeVisible();
      await playExpect(containerDetailsPage.heading).toContainText(exactInstructLabContainerName);
      await playExpect
        .poll(async () => containerDetailsPage.getState(), { timeout: 90_000, intervals: [1_000] })
        .toContain(ContainerState.Running);
    });

    test('Cleanup the InstructLab container', async ({ runner, page, navigationBar }) => {
      const containersPage = await navigationBar.openContainers();
      await playExpect(containersPage.heading).toBeVisible();
      await containersPage.deleteContainer(exactInstructLabContainerName);
      await playExpect
        .poll(async () => await containersPage.containerExists(exactInstructLabContainerName), { timeout: 60_000 })
        .toBeFalsy();
      await deleteUnusedImages(navigationBar);
      aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
      await aiLabPage.navigationBar.waitForLoad();
      instructLabPage = await aiLabPage.navigationBar.openTryInstructLab();
      await instructLabPage.waitForLoad();
      await playExpect(instructLabPage.startInstructLabButton).toBeEnabled();
    });
  });

  test.describe.serial(`Start Llama Stack from sidebar and verify containers`, { tag: '@smoke' }, () => {
    test.skip(!!isCI && !!isWindows, 'Skipping Llama Stack tests on GitHub Actions with Windows platform');
    let llamaStackPage: AiLlamaStackPage;
    const llamaStackContainerNames: string[] = [];

    test.beforeAll(`Open Llama Stack`, async ({ runner, page, navigationBar }) => {
      aiLabPage = await reopenAILabDashboard(runner, page, navigationBar);
      await aiLabPage.navigationBar.waitForLoad();
      llamaStackPage = await aiLabPage.navigationBar.openLlamaStack();
      await llamaStackPage.waitForLoad();
    });

    test(`Start Llama Stack containers`, async () => {
      test.setTimeout(300_000);
      await llamaStackPage.waitForLoad();
      await llamaStackPage.runLlamaStackContainer();
      await playExpect(llamaStackPage.openLlamaStackContainerButton).toBeVisible({ timeout: 120_000 });
      await playExpect(llamaStackPage.exploreLlamaStackEnvironmentButton).toBeVisible({ timeout: 120_000 });
      await playExpect(llamaStackPage.openLlamaStackContainerButton).toBeEnabled({ timeout: 30_000 });
      await playExpect(llamaStackPage.exploreLlamaStackEnvironmentButton).toBeEnabled({ timeout: 30_000 });
    });

    test(`Verify Llama Stack containers are running`, async ({ navigationBar }) => {
      let containersPage = await navigationBar.openContainers();
      await playExpect(containersPage.heading).toBeVisible();

      await playExpect
        .poll(
          async () => {
            const allRows = await containersPage.getAllTableRows();
            llamaStackContainerNames.length = 0;
            for (const row of allRows) {
              const text = await row.textContent();
              if (text?.includes('llama-stack')) {
                const containerNameMatch = RegExp(/\b(llama-stack[^\s]*)/).exec(text);
                if (containerNameMatch) {
                  llamaStackContainerNames.push(containerNameMatch[1]);
                }
              }
            }
            return llamaStackContainerNames.length;
          },
          {
            timeout: 30_000,
            intervals: [5_000],
          },
        )
        .toBe(2);

      console.log(`Found containers: ${llamaStackContainerNames.join(', ')}`);

      for (const container of llamaStackContainerNames) {
        containersPage = await navigationBar.openContainers();
        await playExpect(containersPage.heading).toBeVisible();
        const containersDetailsPage = await containersPage.openContainersDetails(container);
        await playExpect(containersDetailsPage.heading).toBeVisible();
        await playExpect
          .poll(async () => containersDetailsPage.getState(), { timeout: 30_000 })
          .toContain(ContainerState.Running);
      }
    });

    test.afterAll(`Stop Llama Stack containers`, async ({ navigationBar }) => {
      for (const container of llamaStackContainerNames) {
        const containersPage = await navigationBar.openContainers();
        await playExpect(containersPage.heading).toBeVisible();
        await containersPage.deleteContainer(container);
        await playExpect
          .poll(async () => await containersPage.containerExists(container), { timeout: 30_000 })
          .toBeFalsy();
      }
      await deleteUnusedImages(navigationBar);
    });
  });
});

async function cleanupServices(): Promise<void> {
  try {
    const modelServicePage = await aiLabPage.navigationBar.openServices();
    await modelServicePage.waitForLoad();
    if ((await modelServicePage.getCurrentModelCount()) === 0) return;
    await modelServicePage.deleteAllCurrentModels();
    await playExpect.poll(async () => await modelServicePage.getCurrentModelCount(), { timeout: 60_000 }).toBe(0);
  } catch (error) {
    console.log(`Error while cleaning up service models: ${error}`);
  }
}

async function getModelServicePort(appModelName: string): Promise<string> {
  const modelServicePage = await aiLabPage.navigationBar.openServices();
  await modelServicePage.waitForLoad();
  const serviceDetailsPage = await modelServicePage.openServiceDetails(appModelName);

  await playExpect
    // eslint-disable-next-line sonarjs/no-nested-functions
    .poll(async () => await serviceDetailsPage.getServiceState(), { timeout: 60_000 })
    .toBe('RUNNING');

  return await serviceDetailsPage.getInferenceServerPort();
}

async function deleteAllModels(): Promise<void> {
  const modelCatalogPage = await aiLabPage.navigationBar.openCatalog();
  await modelCatalogPage.waitForLoad();
  await modelCatalogPage.deleteAllModels();
}

async function restartApp(appName: string): Promise<void> {
  const aiRunningAppsPage = await aiLabPage.navigationBar.openRunningApps();
  await aiRunningAppsPage.waitForLoad();
  await playExpect.poll(async () => await aiRunningAppsPage.appExists(appName), { timeout: 10_000 }).toBeTruthy();
  await playExpect
    .poll(async () => await aiRunningAppsPage.getCurrentStatusForApp(appName), { timeout: 60_000 })
    .toBe('RUNNING');
  const aiApp = await aiRunningAppsPage.getRowForApp(appName);
  const appProgressBar = aiApp.getByRole('progressbar', { name: 'Loading' });
  // Trigger restart and watch for dialog/progress bar in parallel to avoid race condition
  // See: https://github.com/containers/podman-desktop-extension-ai-lab/issues/3663

  const dialogPromise = handleConfirmationDialog(
    aiLabPage.page,
    podmanAILabExtension.extensionName,
    true,
    'Reset',
    'Cancel',
    25_000,
  ).catch(() => {
    // Dialog didn't appear - this is expected when repo is clean
  });
  const progressBarPromise = playExpect(appProgressBar)
    .toBeVisible({ timeout: 60_000 })
    .catch(() => {
      console.log(`Warning: Progress bar did not appear for app "${appName}" during restart`);
    });

  const restartPromise = aiRunningAppsPage.restartApp(appName);

  await Promise.all([dialogPromise, progressBarPromise, restartPromise]);
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
  try {
    const imagesPage = await navigationBar.openImages();
    await playExpect(imagesPage.heading).toBeVisible();

    await imagesPage.deleteAllUnusedImages();
    await playExpect.poll(async () => await imagesPage.getCountOfImagesByStatus('UNUSED'), { timeout: 90_000 }).toBe(0);
  } catch (error) {
    console.error('Error during deleteUnusedImages:', error);
  }
}

async function waitForCatalogModel(modelName: string): Promise<boolean> {
  const recipeCatalogOage = await aiLabPage.navigationBar.openRecipesCatalog();
  await recipeCatalogOage.waitForLoad();

  const catalogPage = await aiLabPage.navigationBar.openCatalog();
  await catalogPage.waitForLoad();

  return await catalogPage.isModelDownloaded(modelName);
}
