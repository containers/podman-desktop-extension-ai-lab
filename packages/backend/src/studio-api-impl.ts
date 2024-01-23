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

import * as path from 'node:path';
import type { CatalogManager } from './managers/catalogManager';
import type { Catalog } from '@shared/src/models/ICatalog';
import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';
import type { ModelsManager } from './managers/modelsManager';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private appUserDirectory: string,
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private playgroundManager: PlayGroundManager,
    private catalogManager: CatalogManager,
    private modelsManager: ModelsManager,
  ) {}

  async ping(): Promise<string> {
    return 'pong';
  }

  async openURL(url: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(url));
  }

  async getPullingStatus(recipeId: string): Promise<RecipeStatus> {
    return this.recipeStatusRegistry.getStatus(recipeId);
  }

  async getPullingStatuses(): Promise<Map<string, RecipeStatus>> {
    return this.recipeStatusRegistry.getStatuses();
  }

  async getModelById(modelId: string): Promise<ModelInfo> {
    const model = this.catalogManager.getModels().find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  async pullApplication(recipeId: string): Promise<void> {
    const recipe = this.catalogManager.getRecipes().find(recipe => recipe.id === recipeId);
    if (!recipe) throw new Error('Not found');

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = await this.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    this.applicationManager.pullApplication(recipe, model).catch((error: unknown) => console.warn(error));

    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.modelsManager.getLocalModels();
    const localIds = local.map(l => l.id);
    return this.catalogManager.getModels().filter(m => localIds.includes(m.id));
  }

  async startPlayground(modelId: string): Promise<void> {
    // TODO: improve the following
    const localModelInfo = this.modelsManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }

    // TODO: we need to stop doing that.
    const modelPath = path.resolve(this.appUserDirectory, 'models', modelId, localModelInfo[0].file);

    await this.playgroundManager.startPlayground(modelId, modelPath);
  }

  async stopPlayground(modelId: string): Promise<void> {
    await this.playgroundManager.stopPlayground(modelId);
  }

  askPlayground(modelId: string, prompt: string): Promise<number> {
    const localModelInfo = this.modelsManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }
    return this.playgroundManager.askPlayground(localModelInfo[0], prompt);
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
}
