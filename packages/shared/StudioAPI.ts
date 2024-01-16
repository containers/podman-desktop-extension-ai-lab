import type { Recipe } from '@shared/models/IRecipe';
import type { Category } from '@shared/models/ICategory';
import { RecipeStatus } from '@shared/models/IRecipeStatus';
import { ModelInfo } from '@shared/models/IModelInfo';
import { ModelResponse } from '@shared/models/IModelResponse';
import { Task } from './models/ITask';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getRecentRecipes(): Promise<Recipe[]>;
  abstract getCategories(): Promise<Category[]>;
  abstract getRecipesByCategory(categoryId: string): Promise<Recipe[]>;
  abstract getRecipeById(recipeId: string): Promise<Recipe>;
  abstract getModelById(modelId: string): Promise<ModelInfo>;
  abstract searchRecipes(query: string): Promise<Recipe[]>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>
  abstract pullApplication(recipeId: string): Promise<void>;
  abstract openURL(url: string): Promise<void>;
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

