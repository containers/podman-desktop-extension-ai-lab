/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type { RecipeStatus } from './models/IRecipeStatus';
import type { ModelInfo } from './models/IModelInfo';
import type { QueryState } from './models/IPlaygroundQueryState';
import type { Catalog } from './models/ICatalog';
import type { PlaygroundState } from './models/IPlaygroundState';
import type { TelemetryTrustedValue } from '@podman-desktop/api';
import type { EnvironmentState } from './models/IEnvironmentState';
import type { Task } from './models/ITask';
import type { LocalRepository } from './models/ILocalRepository';

export abstract class StudioAPI {
  abstract ping(): Promise<string>;
  abstract getCatalog(): Promise<Catalog>;
  abstract getPullingStatus(recipeId: string): Promise<RecipeStatus>;
  abstract getPullingStatuses(): Promise<Map<string, RecipeStatus>>;
  abstract pullApplication(recipeId: string, modelId: string): Promise<void>;
  abstract openURL(url: string): Promise<boolean>;
  abstract openFile(file: string): Promise<boolean>;
  /**
   * Get the information of models saved locally into the user's directory
   */
  abstract getModelsInfo(): Promise<ModelInfo[]>;
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
  abstract requestRemoveEnvironment(recipeId: string): Promise<void>;
  abstract requestRestartEnvironment(recipeId: string): Promise<void>;

  abstract telemetryLogUsage(eventName: string, data?: Record<string, unknown | TelemetryTrustedValue>): Promise<void>;
  abstract telemetryLogError(eventName: string, data?: Record<string, unknown | TelemetryTrustedValue>): Promise<void>;

  abstract getLocalRepositories(): Promise<LocalRepository[]>;

  abstract getTasks(): Promise<Task[]>;
}
