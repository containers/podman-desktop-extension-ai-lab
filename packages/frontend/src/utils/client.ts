import type { Recipe } from '@shared/models/IRecipe';
import type { Category } from '@shared/models/ICategory';
import content from './ai.json';
import type { StudioAPI } from '@shared/StudioAPI';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioClient implements StudioAPI {
  podmanDesktopApi = acquirePodmanDesktopApi();

  async ping(): Promise<string> {
    return 'pong';
  }

  async getRecentRecipes(): Promise<Recipe[]> {
    return content.recipes.toSpliced(0, 10);
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
}

export const studioClient = new StudioClient();
