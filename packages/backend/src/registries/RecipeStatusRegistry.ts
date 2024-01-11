import { Task } from '@shared/models/ITask';

export class RecipeStatusRegistry {
  private statuses: Map<string, Task[]> = new Map<string, Task[]>();

  setStatus(recipeId: string, tasks: Task[]) {
    this.statuses.set(recipeId, tasks);
  }

  getStatus(recipeId: string): Task[] | undefined {
    return this.statuses.get(recipeId);
  }
}
