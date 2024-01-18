import type { StudioAPI } from '@shared/src/StudioAPI';
import type { Category } from '@shared/src/models/ICategory';
import type { Recipe } from '@shared/src/models/IRecipe';
import defaultCatalog from './ai.json';
import type { ApplicationManager } from './managers/applicationManager';
import type { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { TaskRegistry } from './registries/TaskRegistry';
import type { Task } from '@shared/src/models/ITask';
import type { PlayGroundManager } from './playground';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
import type { Catalog } from '@shared/src/models/ICatalog';

import * as path from 'node:path';
import * as fs from 'node:fs';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {
  private catalog: Catalog;

  constructor(
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private taskRegistry: TaskRegistry,
    private playgroundManager: PlayGroundManager,
  ) {
    // We start with an empty catalog, for the methods to work before the catalog is loaded
    this.catalog = {
      categories: [],
      models: [],
      recipes: [],
    };
  }

  async loadCatalog() {
    const catalogPath = path.resolve(this.applicationManager.appUserDirectory, 'catalog.json');
    try {
      // TODO(feloy): watch catalog file and update catalog with new content
      await fs.promises
        .readFile(catalogPath, 'utf-8')
        .then((data: string) => {
          try {
            const cat = JSON.parse(data) as Catalog;
            // TODO(feloy): check version and format
            console.log('using user catalog');
            this.setNewCatalog(cat);
          } catch (err: unknown) {
            console.error('unable to parse catalog file, reverting to default catalog', err);
            this.setNewCatalog(defaultCatalog);
          }
        })
        .catch((err: unknown) => {
          console.error('got err', err);
          console.error('unable to read catalog file, reverting to default catalog', err);
          this.setNewCatalog(defaultCatalog);
        });
    } catch (err: unknown) {
      console.error('unable to read catalog file, reverting to default catalog', err);
      this.setNewCatalog(defaultCatalog);
    }
  }

  setNewCatalog(newCatalog: Catalog) {
    // TODO(feloy): send message to frontend with new catalog
    this.catalog = newCatalog;
  }

  async openURL(url: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(url));
  }

  async getPullingStatus(recipeId: string): Promise<RecipeStatus> {
    return this.recipeStatusRegistry.getStatus(recipeId);
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  async getRecentRecipes(): Promise<Recipe[]> {
    return []; // no recent implementation for now
  }

  async getCategories(): Promise<Category[]> {
    return this.catalog.categories;
  }

  async getRecipesByCategory(categoryId: string): Promise<Recipe[]> {
    if (categoryId === RECENT_CATEGORY_ID) return this.getRecentRecipes();

    return this.catalog.recipes.filter(recipe => recipe.categories.includes(categoryId));
  }

  async getRecipeById(recipeId: string): Promise<Recipe> {
    const recipe = (this.catalog.recipes as Recipe[]).find(recipe => recipe.id === recipeId);
    if (recipe) return recipe;
    throw new Error('Not found');
  }

  async getModelById(modelId: string): Promise<ModelInfo> {
    const model = this.catalog.models.find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  async getModelsByIds(ids: string[]): Promise<ModelInfo[]> {
    return this.catalog.models.filter(m => ids.includes(m.id)) ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async searchRecipes(_query: string): Promise<Recipe[]> {
    return []; // todo: not implemented
  }

  async pullApplication(recipeId: string): Promise<void> {
    console.log('StudioApiImpl pullApplication', recipeId);
    const recipe: Recipe = await this.getRecipeById(recipeId);
    console.log('StudioApiImpl recipe', recipe);

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = await this.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    this.applicationManager.pullApplication(recipe, model).catch((error: unknown) => console.warn(error));

    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.applicationManager.getLocalModels();
    const localIds = local.map(l => l.id);
    return this.catalog.models.filter(m => localIds.includes(m.id));
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
}
