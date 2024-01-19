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
import type { Category } from '@shared/src/models/ICategory';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ApplicationManager } from './managers/applicationManager';
import type { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { TaskRegistry } from './registries/TaskRegistry';
import type { Task } from '@shared/src/models/ITask';
import type { PlayGroundManager } from './managers/playground';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';

import * as path from 'node:path';
import type { CatalogManager } from './managers/catalogManager';
import type { Catalog } from '@shared/src/models/ICatalog';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private taskRegistry: TaskRegistry,
    private playgroundManager: PlayGroundManager,
    private catalogManager: CatalogManager,
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

  async getRecentRecipes(): Promise<Recipe[]> {
    return []; // no recent implementation for now
  }

  async getCategories(): Promise<Category[]> {
    return this.catalogManager.getCategories();
  }

  async getRecipesByCategory(categoryId: string): Promise<Recipe[]> {
    if (categoryId === RECENT_CATEGORY_ID) return this.getRecentRecipes();

    // TODO: move logic to catalog manager
    return this.catalogManager.getRecipes().filter(recipe => recipe.categories.includes(categoryId));
  }

  async getRecipeById(recipeId: string): Promise<Recipe> {
    // TODO: move logic to catalog manager
    const recipe = this.catalogManager.getRecipes().find(recipe => recipe.id === recipeId);
    if (recipe) return recipe;
    throw new Error('Not found');
  }

  async getModelById(modelId: string): Promise<ModelInfo> {
    // TODO: move logic to catalog manager
    const model = this.catalogManager.getModels().find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  async getModelsByIds(ids: string[]): Promise<ModelInfo[]> {
    // TODO: move logic to catalog manager
    return this.catalogManager.getModels().filter(m => ids.includes(m.id)) ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async searchRecipes(_query: string): Promise<Recipe[]> {
    return []; // todo: not implemented
  }

  async pullApplication(recipeId: string): Promise<void> {
    const recipe: Recipe = await this.getRecipeById(recipeId);

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = await this.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    this.applicationManager.pullApplication(recipe, model).catch((error: unknown) => console.warn(error));

    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    // TODO: move logic to catalog manager
    const local = this.applicationManager.getLocalModels();
    const localIds = local.map(l => l.id);
    return this.catalogManager.getModels().filter(m => localIds.includes(m.id));
  }

  async getTasksByLabel(label: string): Promise<Task[]> {
    return this.taskRegistry.getTasksByLabel(label);
  }

  async startPlayground(modelId: string): Promise<void> {
    const localModelInfo = this.applicationManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }

    const modelPath = path.resolve(this.applicationManager.appUserDirectory, 'models', modelId, localModelInfo[0].file);

    await this.playgroundManager.startPlayground(modelId, modelPath);
  }

  askPlayground(modelId: string, prompt: string): Promise<number> {
    const localModelInfo = this.applicationManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }
    return this.playgroundManager.askPlayground(localModelInfo[0], prompt);
  }

  async getPlaygroundStates(): Promise<QueryState[]> {
    return this.playgroundManager.getState();
  }

  async getCatalog(): Promise<Catalog> {
    return this.catalogManager.getCatalog();
  }
}
