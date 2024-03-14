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

import type { StudioAPI } from '@shared/src/StudioAPI';
import type { ApplicationManager } from './managers/applicationManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { PlayGroundManager } from './managers/playground';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';

import type { CatalogManager } from './managers/catalogManager';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';
import type { ModelsManager } from './managers/modelsManager';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import type { Task } from '@shared/src/models/ITask';
import type { TaskRegistry } from './registries/TaskRegistry';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import type { LocalRepositoryRegistry } from './registries/LocalRepositoryRegistry';
import path from 'node:path';
import type { InferenceServer } from '@shared/src/models/IInference';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { InferenceManager } from './managers/inference/inferenceManager';
import { getFreeRandomPort } from './utils/ports';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private applicationManager: ApplicationManager,
    private playgroundManager: PlayGroundManager,
    private catalogManager: CatalogManager,
    private modelsManager: ModelsManager,
    private telemetry: podmanDesktopApi.TelemetryLogger,
    private localRepositories: LocalRepositoryRegistry,
    private taskRegistry: TaskRegistry,
    private inferenceManager: InferenceManager,
  ) {}

  async getInferenceServers(): Promise<InferenceServer[]> {
    return this.inferenceManager.getServers();
  }

  createInferenceServer(config: InferenceServerConfig): Promise<void> {
    try {
      return this.inferenceManager.createInferenceServer(config);
    } catch (err: unknown) {
      console.error('Something went wrong while trying to start inference server', err);
      throw err;
    }
  }

  startInferenceServer(containerId: string): Promise<void> {
    return this.inferenceManager.startInferenceServer(containerId);
  }

  stopInferenceServer(containerId: string): Promise<void> {
    return this.inferenceManager.stopInferenceServer(containerId);
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  async openURL(url: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(url));
  }

  async openFile(file: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.file(file));
  }

  async pullApplication(recipeId: string, modelId: string): Promise<void> {
    const recipe = this.catalogManager.getRecipes().find(recipe => recipe.id === recipeId);
    if (!recipe) throw new Error(`recipe with if ${recipeId} not found`);

    const model = this.catalogManager.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    podmanDesktopApi.window
      .withProgress({ location: podmanDesktopApi.ProgressLocation.TASK_WIDGET, title: `Pulling ${recipe.name}.` }, () =>
        this.applicationManager.pullApplication(recipe, model),
      )
      .catch((err: unknown) => {
        console.error('Something went wrong while trying to start application', err);
        podmanDesktopApi.window
          .showErrorMessage(`Error starting the application "${recipe.name}": ${String(err)}`)
          .catch((err: unknown) => {
            console.error(`Something went wrong with confirmation modals`, err);
          });
      });
  }

  async getModelsInfo(): Promise<ModelInfo[]> {
    return this.modelsManager.getModelsInfo();
  }

  async startPlayground(modelId: string): Promise<void> {
    const modelPath = this.modelsManager.getLocalModelPath(modelId);
    this.playgroundManager.startPlayground(modelId, modelPath).catch((err: unknown) => {
      this.playgroundManager.setPlaygroundError(modelId, `Something went wrong while starting the playground: ${err}`);
    });
  }

  async stopPlayground(modelId: string): Promise<void> {
    this.playgroundManager.stopPlayground(modelId).catch((err: unknown) => {
      this.playgroundManager.setPlaygroundError(modelId, `Something went wrong while stopping the playground: ${err}`);
    });
  }

  async askPlayground(modelId: string, prompt: string): Promise<number> {
    const modelInfo = this.modelsManager.getModelInfo(modelId);
    return this.playgroundManager.askPlayground(modelInfo, prompt);
  }

  async getPlaygroundQueriesState(): Promise<QueryState[]> {
    return this.playgroundManager.getQueriesState();
  }

  async getPlaygroundsState(): Promise<PlaygroundState[]> {
    return this.playgroundManager.getPlaygroundsState();
  }

  async getCatalog(): Promise<ApplicationCatalog> {
    return this.catalogManager.getCatalog();
  }

  async requestRemoveLocalModel(modelId: string): Promise<void> {
    const modelInfo = this.modelsManager.getLocalModelInfo(modelId);

    // Do not wait on the promise as the api would probably timeout before the user answer.
    podmanDesktopApi.window
      .showWarningMessage(
        `Are you sure you want to delete ${modelId} ? The following files will be removed from disk "${modelInfo.file}".`,
        'Confirm',
        'Cancel',
      )
      .then((result: string) => {
        if (result === 'Confirm') {
          this.modelsManager.deleteLocalModel(modelId).catch((err: unknown) => {
            console.error('Something went wrong while deleting the models', err);
            // Lets reloads the models (could fix the issue)
            this.modelsManager.loadLocalModels().catch((err: unknown) => {
              console.error('Cannot reload the models', err);
            });
          });
        }
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong with confirmation modals`, err);
      });
  }

  async getModelsDirectory(): Promise<string> {
    return this.modelsManager.getModelsDirectory();
  }

  navigateToContainer(containerId: string): Promise<void> {
    return podmanDesktopApi.navigation.navigateToContainer(containerId);
  }

  async navigateToPod(podId: string): Promise<void> {
    const pods = await podmanDesktopApi.containerEngine.listPods();
    const pod = pods.find(pod => pod.Id === podId);
    if (pod === undefined) throw new Error(`Pod with id ${podId} not found.`);
    return podmanDesktopApi.navigation.navigateToPod(pod.kind, pod.Name, pod.engineId);
  }

  async getApplicationsState(): Promise<ApplicationState[]> {
    return this.applicationManager.getApplicationsState();
  }

  async requestRemoveApplication(recipeId: string, modelId: string): Promise<void> {
    const recipe = this.catalogManager.getRecipeById(recipeId);
    // Do not wait on the promise as the api would probably timeout before the user answer.
    podmanDesktopApi.window
      .showWarningMessage(
        `Stop the AI App "${recipe.name}"? This will delete the containers running the application and model.`,
        'Confirm',
        'Cancel',
      )
      .then((result: string) => {
        if (result === 'Confirm') {
          this.applicationManager.deleteApplication(recipeId, modelId).catch((err: unknown) => {
            console.error(`error deleting AI App's pod: ${String(err)}`);
            podmanDesktopApi.window
              .showErrorMessage(
                `Error deleting the AI App "${recipe.name}". You can try to stop and delete the AI App's pod manually.`,
              )
              .catch((err: unknown) => {
                console.error(`Something went wrong with confirmation modals`, err);
              });
          });
        }
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong with confirmation modals`, err);
      });
  }

  async requestRestartApplication(recipeId: string, modelId: string): Promise<void> {
    const recipe = this.catalogManager.getRecipeById(recipeId);
    // Do not wait on the promise as the api would probably timeout before the user answer.
    podmanDesktopApi.window
      .showWarningMessage(
        `Restart the AI App "${recipe.name}"? This will delete the containers running the application and model, rebuild the images with the current sources, and restart the containers.`,
        'Confirm',
        'Cancel',
      )
      .then((result: string) => {
        if (result === 'Confirm') {
          this.applicationManager.restartApplication(recipeId, modelId).catch((err: unknown) => {
            console.error(`error restarting AI App: ${String(err)}`);
            podmanDesktopApi.window
              .showErrorMessage(`Error restarting the AI App "${recipe.name}"`)
              .catch((err: unknown) => {
                console.error(`Something went wrong with confirmation modals`, err);
              });
          });
        }
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong with confirmation modals`, err);
      });
  }

  async telemetryLogUsage(
    eventName: string,
    data?: Record<string, unknown | podmanDesktopApi.TelemetryTrustedValue>,
  ): Promise<void> {
    this.telemetry.logUsage(eventName, data);
  }

  async telemetryLogError(
    eventName: string,
    data?: Record<string, unknown | podmanDesktopApi.TelemetryTrustedValue>,
  ): Promise<void> {
    this.telemetry.logError(eventName, data);
  }

  async getLocalRepositories(): Promise<LocalRepository[]> {
    return this.localRepositories.getLocalRepositories();
  }

  async getTasks(): Promise<Task[]> {
    return this.taskRegistry.getTasks();
  }

  async openVSCode(directory: string): Promise<void> {
    if (!path.isAbsolute(directory)) {
      throw new Error('Do not support relative directory.');
    }

    const unixPath: string = path.normalize(directory).replace(/[\\/]+/g, '/');

    podmanDesktopApi.env
      .openExternal(podmanDesktopApi.Uri.parse(unixPath).with({ scheme: 'vscode', authority: 'file' }))
      .catch((err: unknown) => {
        console.error('Something went wrong while trying to open VSCode', err);
      });
  }

  async downloadModel(modelId: string): Promise<void> {
    const modelInfo: ModelInfo = this.modelsManager.getModelInfo(modelId);

    // Do not wait for the download task as it is too long.
    this.modelsManager.requestDownloadModel(modelInfo).catch((err: unknown) => {
      console.error(`Something went wrong while trying to download the model ${modelId}`, err);
    });
  }

  getHostFreePort(): Promise<number> {
    return getFreeRandomPort('0.0.0.0');
  }
}
