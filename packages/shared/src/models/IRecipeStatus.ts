import type { Task } from './ITask';

export interface RecipeStatus {
  recipeId: string;
  tasks: Task[];
}
