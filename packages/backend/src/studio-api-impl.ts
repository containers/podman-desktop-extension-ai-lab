import type { StudioAPI } from '@shared/src/StudioAPI';
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
import { MSG_NEW_CATALOG_STATE } from '@shared/Messages';

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
    private webview: podmanDesktopApi.Webview,
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
      this.watchCatalogFile(catalogPath); // do not await, we want to do this async
    } catch (err: unknown) {
      console.error("unable to watch catalog file, changes to the catalog file won't be reflected to the UI", err);
    }

    try {
      if (!fs.existsSync(catalogPath)) {
        await this.setCatalog(defaultCatalog);
        return;
      }
      const cat = await this.readAndAnalyzeCatalog(catalogPath);
      await this.setCatalog(cat);
    } catch (err: unknown) {
      console.error('unable to read catalog file, reverting to default catalog', err);
      await this.setCatalog(defaultCatalog);
    }
  }

  watchCatalogFile(path: string) {
    const watcher = podmanDesktopApi.fs.createFileSystemWatcher(path);
    watcher.onDidCreate(async () => {
      try {
        const cat = await this.readAndAnalyzeCatalog(path);
        await this.setCatalog(cat);
      } catch (err: unknown) {
        console.error('unable to read created catalog file, continue using default catalog', err);
      }
    });
    watcher.onDidDelete(async () => {
      console.log('user catalog file deleted, reverting to default catalog');
      await this.setCatalog(defaultCatalog);
    });
    watcher.onDidChange(async () => {
      try {
        const cat = await this.readAndAnalyzeCatalog(path);
        await this.setCatalog(cat);
      } catch (err: unknown) {
        console.error('unable to read modified catalog file, reverting to default catalog', err);
      }
    });
  }

  async readAndAnalyzeCatalog(path: string): Promise<Catalog> {
    const data = await fs.promises.readFile(path, 'utf-8');
    return JSON.parse(data) as Catalog;
    // TODO(feloy): check version, ...
  }

  async setCatalog(newCatalog: Catalog) {
    this.catalog = newCatalog;
    await this.webview.postMessage({
      id: MSG_NEW_CATALOG_STATE,
      body: this.catalog,
    });
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

  async getCatalog(): Promise<Catalog> {
    return this.catalog;
  }

  getRecipeById(recipeId: string): Recipe {
    const recipe = (this.catalog.recipes as Recipe[]).find(recipe => recipe.id === recipeId);
    if (recipe) return recipe;
    throw new Error('Not found');
  }

  getModelById(modelId: string): ModelInfo {
    const model = this.catalog.models.find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  async pullApplication(recipeId: string): Promise<void> {
    console.log('StudioApiImpl pullApplication', recipeId);
    const recipe: Recipe = this.getRecipeById(recipeId);
    console.log('StudioApiImpl recipe', recipe);

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = this.getModelById(modelId);

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
