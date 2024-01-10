import type { Recipe } from './models/IRecipe';
import type { Category } from './models/ICategory';

export interface StudioAPI {
  ping(): Promise<string>;
  getRecentRecipes(): Promise<Recipe[]>;
  getCategories(): Promise<Category[]>;
  getRecipesByCategory(categoryId: string): Promise<Recipe[]>;
  getRecipeById(recipeId: string): Promise<Recipe>;
  searchRecipes(query: string): Promise<Recipe[]>;
}

