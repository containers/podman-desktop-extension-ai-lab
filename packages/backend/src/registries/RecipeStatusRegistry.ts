import { RecipeStatus } from '@shared/models/IRecipeStatus';

export class RecipeStatusRegistry {
  private statuses: Map<string, RecipeStatus> = new Map<string, RecipeStatus>();

  setStatus(recipeId: string, status: RecipeStatus) {
    this.statuses.set(recipeId, status);
  }

  getStatus(recipeId: string): RecipeStatus | undefined {
    return this.statuses.get(recipeId);
  }
}
