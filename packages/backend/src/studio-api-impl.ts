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
import type { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { PlayGroundManager } from './managers/playground';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';

import type { CatalogManager } from './managers/catalogManager';
import type { Catalog } from '@shared/src/models/ICatalog';
import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';
import type { ModelsManager } from './managers/modelsManager';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import type { EnvironmentManager } from './managers/environmentManager';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private playgroundManager: PlayGroundManager,
    private catalogManager: CatalogManager,
    private modelsManager: ModelsManager,
    private environmentManager: EnvironmentManager,
    private telemetry: podmanDesktopApi.TelemetryLogger,
  ) {}

  async ping(): Promise<string> {
    return 'pong';
  }

  async openURL(url: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(url));
  }

  async openFile(file: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.file(file));
  }

  async getPullingStatus(recipeId: string): Promise<RecipeStatus> {
    return this.recipeStatusRegistry.getStatus(recipeId);
  }

  async getPullingStatuses(): Promise<Map<string, RecipeStatus>> {
    return this.recipeStatusRegistry.getStatuses();
  }

  async pullApplication(recipeId: string): Promise<void> {
    const recipe = this.catalogManager.getRecipes().find(recipe => recipe.id === recipeId);
    if (!recipe) throw new Error('Not found');

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = this.catalogManager.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    podmanDesktopApi.window
      .withProgress({ location: podmanDesktopApi.ProgressLocation.TASK_WIDGET, title: `Pulling ${recipe.name}.` }, () =>
        this.applicationManager.pullApplication(recipe, model),
      )
      .catch(() => {
        this.recipeStatusRegistry.setRecipeState(recipeId, 'error');
      });
  }

  async getLocalModels(): Promise<ModelInfo[]> {
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
    const localModelInfo = this.modelsManager.getLocalModelInfo(modelId);
    return this.playgroundManager.askPlayground(localModelInfo, prompt);
  }

  async getPlaygroundQueriesState(): Promise<QueryState[]> {
    return this.playgroundManager.getQueriesState();
  }

  async getPlaygroundsState(): Promise<PlaygroundState[]> {
    return this.playgroundManager.getPlaygroundsState();
  }

  async getCatalog(): Promise<Catalog> {
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

  async getEnvironmentsState(): Promise<EnvironmentState[]> {
    return this.environmentManager.getEnvironmentsState();
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
}
