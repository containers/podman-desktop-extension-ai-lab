import type { RecipeStatus } from './models/IRecipeStatus';
import type { ModelInfo } from './models/IModelInfo';
import type { Task } from './models/ITask';
import type { QueryState } from './models/IPlaygroundQueryState';
import type { Catalog } from './models/ICatalog';
import type { PlaygroundState } from './models/IPlaygroundState';
import type { RouterState } from './models/IRouterState';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getCatalog(): Promise<Catalog>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>;
  abstract pullApplication(recipeId: string): Promise<void>;
  abstract openURL(url: string): Promise<boolean>;
  /**
   * Get the information of models saved locally into the extension's storage directory
   */
  abstract getLocalModels(): Promise<ModelInfo[]>;

  abstract startPlayground(modelId: string): Promise<void>;
  abstract stopPlayground(modelId: string): Promise<void>;
  abstract askPlayground(modelId: string, prompt: string): Promise<number>;

  /**
   * Get task by label
   * @param label
   */
  abstract getTasksByLabel(label: string): Promise<Task[]>;

  abstract getPlaygroundQueriesState(): Promise<QueryState[]>;

  abstract getPlaygroundsState(): Promise<PlaygroundState[]>;

  abstract saveRouterState(state: RouterState): Promise<void>;
  abstract getRouterState(): Promise<RouterState>;
}
