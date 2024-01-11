import { Task } from './ITask';

export type RecipeStatusState = 'none' | 'loading' | 'pulled' | 'running' | 'error';

export interface RecipeStatus {
  recipeId: string;
  tasks: Task[];
  state: RecipeStatusState;
}
