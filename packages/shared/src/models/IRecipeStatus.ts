import type { PodInfo } from '@podman-desktop/api';
import type { Task } from './ITask';

export type RecipeStatusState =
  | 'none'
  | 'loading'
  | 'stopping'
  | 'pulled'
  | 'running'
  | 'error'
  | 'removing'
  | 'unknown';
export const recipeStatusMap = {
  none: 'Not running',
  loading: 'Loading',
  stopping: 'Stopping',
  pulled: 'Pulled',
  running: 'Running',
  error: 'Error',
  removing: 'Removing',
  unknown: 'Unknown',
};

export interface RecipeStatus {
  recipeId: string;
  tasks: Task[];
  state: RecipeStatusState;
  pod: PodInfo;
}
