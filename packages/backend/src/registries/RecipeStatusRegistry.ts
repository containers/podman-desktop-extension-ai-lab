import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';
import type { TaskRegistry } from './TaskRegistry';

export class RecipeStatusRegistry {
  private statuses: Map<string, RecipeStatus> = new Map<string, RecipeStatus>();

  constructor(private taskRegistry: TaskRegistry) {}

  setStatus(recipeId: string, status: RecipeStatus) {
    // Update the TaskRegistry
    if (status.tasks && status.tasks.length > 0) {
      status.tasks.map(task => this.taskRegistry.set(task));
    }
    this.statuses.set(recipeId, status);
  }

  getStatus(recipeId: string): RecipeStatus | undefined {
    return this.statuses.get(recipeId);
  }
}
