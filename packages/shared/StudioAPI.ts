import type { Recipe } from '@shared/models/IRecipe';
import type { Category } from '@shared/models/ICategory';
import { Task } from '@shared/models/ITask';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getRecentRecipes(): Promise<Recipe[]>;
  abstract getCategories(): Promise<Category[]>;
  abstract getRecipesByCategory(categoryId: string): Promise<Recipe[]>;
  abstract getRecipeById(recipeId: string): Promise<Recipe>;
  abstract searchRecipes(query: string): Promise<Recipe[]>;
  abstract getPullingStatus(recipeId: string): Promise<Task[]>
  abstract pullApplication(recipeId: string): Promise<void>;
}

