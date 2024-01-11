import type { StudioAPI } from '@shared/StudioAPI';
import { Category } from '@shared/models/ICategory';
import { Recipe } from '@shared/models/IRecipe';
import content from './ai.json';
import { Task } from '@shared/models/ITask';
import { ModelInfo } from '@shared/models/IModelInfo';
import { Studio } from './studio';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {

  private status: Map<string, Task[]> = new Map<string, Task[]>();

  constructor(private studio: Studio) {}

  async getPullingStatus(recipeId: string): Promise<Task[]> {
      return this.status.get(recipeId) || [];
  }

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

  async pullApplication(recipeId: string): Promise<void> {
    const recipe: Recipe = await this.getRecipeById(recipeId);
    this.status.set(recipeId, [{state: 'loading', name: 'Pulling application'}]);


    //todo: stuff here
    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.studio.getLocalModels();
    const localIds = local.map(l => l.id);
    return content.recipes.flatMap(r => r.models.filter(m => localIds.includes(m.id)));
  }
}
