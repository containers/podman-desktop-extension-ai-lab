import type { RecipeStatus } from './models/IRecipeStatus';
import type { ModelInfo } from './models/IModelInfo';
import type { QueryState } from './models/IPlaygroundQueryState';
import type { Catalog } from './models/ICatalog';
import type { PlaygroundState } from './models/IPlaygroundState';
import type { TelemetryTrustedValue } from '@podman-desktop/api';
import type { EnvironmentState } from './models/IEnvironmentState';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getCatalog(): Promise<Catalog>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>;
  abstract getPullingStatuses(): Promise<Map<string, RecipeStatus>>;
  abstract pullApplication(recipeId: string): Promise<void>;
  abstract openURL(url: string): Promise<boolean>;
  abstract openFile(file: string): Promise<boolean>;
  /**
   * Get the information of models saved locally into the user's directory
   */
  abstract getLocalModels(): Promise<ModelInfo[]>;
  /**
   * Delete the folder containing the model from local storage
   */
  abstract requestRemoveLocalModel(modelId: string): Promise<void>;
  abstract startPlayground(modelId: string): Promise<void>;
  abstract stopPlayground(modelId: string): Promise<void>;
  abstract askPlayground(modelId: string, prompt: string): Promise<number>;
  abstract getPlaygroundQueriesState(): Promise<QueryState[]>;
  abstract getPlaygroundsState(): Promise<PlaygroundState[]>;
  abstract getModelsDirectory(): Promise<string>;
  abstract navigateToContainer(containerId: string): Promise<void>;
  abstract getEnvironmentsState(): Promise<EnvironmentState[]>;

  abstract telemetryLogUsage(eventName: string, data?: Record<string, unknown | TelemetryTrustedValue>): Promise<void>;
  abstract telemetryLogError(eventName: string, data?: Record<string, unknown | TelemetryTrustedValue>): Promise<void>;
}

export const LABEL_RECIPE_ID = 'ai-studio-recipe-id';
