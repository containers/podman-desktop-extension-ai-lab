import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
import type { Task } from "@shared/src/models/ITask";

export interface EnvironmentCell {
    tasks?: Task[];
    envState: EnvironmentState;
    recipeId: string;
  }
  