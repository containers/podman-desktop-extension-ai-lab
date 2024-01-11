import type { Recipe } from '@shared/models/IRecipe';
import type { Category } from '@shared/models/ICategory';
import { RecipeStatus } from '@shared/models/IRecipeStatus';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getRecentRecipes(): Promise<Recipe[]>;
  abstract getCategories(): Promise<Category[]>;
  abstract getRecipesByCategory(categoryId: string): Promise<Recipe[]>;
  abstract getRecipeById(recipeId: string): Promise<Recipe>;
  abstract searchRecipes(query: string): Promise<Recipe[]>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>
  abstract pullApplication(recipeId: string): Promise<void>;
  abstract openURL(url: string): Promise<void>;
}

