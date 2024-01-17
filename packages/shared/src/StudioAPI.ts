import type { Recipe } from './models/IRecipe';
import type { Category } from './models/ICategory';
import type { RecipeStatus } from './models/IRecipeStatus';
import type { ModelInfo } from './models/IModelInfo';
import type { ModelResponse } from './models/IModelResponse';
import type { Task } from './models/ITask';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getRecentRecipes(): Promise<Recipe[]>;
  abstract getCategories(): Promise<Category[]>;
  abstract getRecipesByCategory(categoryId: string): Promise<Recipe[]>;
  abstract getRecipeById(recipeId: string): Promise<Recipe>;
  abstract getModelById(modelId: string): Promise<ModelInfo>;
  abstract getModelsByIds(ids: string[]): Promise<ModelInfo[]>;
  abstract searchRecipes(query: string): Promise<Recipe[]>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>;
  abstract pullApplication(recipeId: string): Promise<void>;
  abstract openURL(url: string): Promise<boolean>;
  /**
   * Get the information of models saved locally into the extension's storage directory
   */
  abstract getLocalModels(): Promise<ModelInfo[]>;

  abstract startPlayground(modelId: string): Promise<void>;
  abstract askPlayground(modelId: string, prompt: string): Promise<ModelResponse>;

  /**
   * Get task by label
   * @param label
   */
  abstract getTasksByLabel(label: string): Promise<Task[]>;
}
