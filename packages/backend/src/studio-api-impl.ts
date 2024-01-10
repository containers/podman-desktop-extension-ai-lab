import type { StudioAPI } from '@shared/StudioAPI';
import { Category } from '@shared/models/ICategory';
import { Recipe } from '@shared/models/IRecipe';
import content from './ai.json';
import { ApplicationManager } from './managers/applicationManager';
import { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import { RecipeStatus } from '@shared/models/IRecipeStatus';
import { Task } from '@shared/models/ITask';
import { ModelInfo } from '@shared/models/IModelInfo';
import { Studio } from './studio';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {
  constructor(
    private applicationManager: ApplicationManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private studio: Studio,
  ) {}

  async openURL(url: string): Promise<void> {
    // TODO: open a browser page
    return;
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

  async searchRecipes(query: string): Promise<Recipe[]> {
    return []; // todo: not implemented
  }

  async pullApplication(recipeId: string): Promise<void> {
    console.log('StudioApiImpl pullApplication', recipeId);
    const recipe: Recipe = await this.getRecipeById(recipeId);
    console.log('StudioApiImpl recipe', recipe);

    // Do not wait for the pull application, run it separately
    new Promise(() => {
      this.applicationManager.pullApplication(recipe);
    });

    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.studio.getLocalModels();
    const localIds = local.map(l => l.id);
    return content.recipes.flatMap(r => r.models.filter(m => localIds.includes(m.id)));
  }
}
