import type { StudioAPI } from '@shared/StudioAPI';
import { Category } from '@shared/models/ICategory';
import { Recipe } from '@shared/models/IRecipe';
import content from './ai.json';
import { AI_STUDIO_FOLDER, ApplicationManager } from './managers/applicationManager';
import { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import { RecipeStatus } from '@shared/models/IRecipeStatus';
import { ModelInfo } from '@shared/models/IModelInfo';
import { TaskRegistry } from './registries/TaskRegistry';
import { Task } from '@shared/models/ITask';
import * as path from 'node:path';
import { ModelResponse } from '@shared/models/IModelResponse';
import { PlayGroundManager } from './playground';
import * as podmanDesktopApi from '@podman-desktop/api';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private taskRegistry: TaskRegistry,
    private playgroundManager: PlayGroundManager,
  ) {}

  async openURL(url: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(
      podmanDesktopApi.Uri.parse(url)
    );
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
    return content.categories;
  }

  async getRecipesByCategory(categoryId: string): Promise<Recipe[]> {
    if (categoryId === RECENT_CATEGORY_ID) return this.getRecentRecipes();

    return content.recipes.filter(recipe => recipe.categories.includes(categoryId));
  }

  async getRecipeById(recipeId: string): Promise<Recipe> {
    const recipe = (content.recipes as Recipe[]).find(recipe => recipe.id === recipeId);
    if (recipe) return recipe;
    throw new Error('Not found');
  }

  getModelById(modelId: string): ModelInfo {
    const model = content.models.find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    return []; // todo: not implemented
  }

  async pullApplication(recipeId: string): Promise<void> {
    console.log('StudioApiImpl pullApplication', recipeId);
    const recipe: Recipe = await this.getRecipeById(recipeId);
    console.log('StudioApiImpl recipe', recipe);

    // the user should have selected one model, we use the first one for the moment
    const modelId = recipe.models[0];
    const model = this.getModelById(modelId);

    // Do not wait for the pull application, run it separately
    new Promise(() => {
      this.applicationManager.pullApplication(recipe, model);
    });

    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.applicationManager.getLocalModels();
    const localIds = local.map(l => l.id);
    return content.models.filter(m => localIds.includes(m.id));
  }

  async getTasksByLabel(label: string): Promise<Task[]> {
    return this.taskRegistry.getTasksByLabel(label);
  }

  async startPlayground(modelId: string): Promise<void> {
    const localModelInfo = this.applicationManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }

    const modelPath = path.resolve(this.applicationManager.homeDirectory, AI_STUDIO_FOLDER, 'models', modelId, localModelInfo[0].file);

    await this.playgroundManager.startPlayground(modelId, modelPath);
  }

  askPlayground(modelId: string, prompt: string): Promise<ModelResponse> {
    const localModelInfo = this.applicationManager.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }
    return this.playgroundManager.askPlayground(localModelInfo[0], prompt);
  }
}
