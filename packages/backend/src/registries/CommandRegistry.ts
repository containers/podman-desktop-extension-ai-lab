/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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
import { type Disposable, commands } from '@podman-desktop/api';
import type { InferenceServer } from '@shared/models/IInference';
import type { Conversation } from '@shared/models/IPlaygroundMessage';
import type { PlaygroundV2Manager } from '../managers/playgroundV2Manager';
import type { InferenceManager } from '../managers/inference/inferenceManager';
import {
  MODEL_NAVIGATE_COMMAND,
  PLAYGROUND_NAVIGATE_COMMAND,
  RECIPE_NAVIGATE_COMMAND,
  SERVICE_NAVIGATE_COMMAND,
} from './NavigationRegistry';
import type { CatalogManager } from '../managers/catalogManager';
import type { ModelsManager } from '../managers/modelsManager';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { Recipe } from '@shared/models/IRecipe';

export const LIST_RESOURCES_COMMAND = 'ai-lab.command.list-resources';

interface NavigationResourceInfo {
  title: string;
  icon: string;
  command: string;
  id: string;
  hidden: boolean;
}
export class CommandRegistry implements Disposable {
  #disposables: Disposable[] = [];

  constructor(
    private inferenceManager: InferenceManager,
    private playgroundManager: PlaygroundV2Manager,
    private modelsManager: ModelsManager,
    private catalogManager: CatalogManager,
  ) {}

  init(): void {
    this.#disposables.push(commands.registerCommand(LIST_RESOURCES_COMMAND, this.listResources.bind(this)));
  }

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  /**
   * Lists all available resources (running inference servers, created playgrounds)
   */
  public async listResources(): Promise<NavigationResourceInfo[]> {
    // Build resource list
    const resources: NavigationResourceInfo[] = [];

    const inferenceServers: InferenceServer[] = this.inferenceManager.getServers();
    inferenceServers.forEach((server: InferenceServer) => {
      const containerId = server.container.containerId;
      const model: ModelInfo | undefined = server.models?.[0];
      const modelName: string = model ? `(${model.name})` : '';
      const serviceName: string = `${containerId.substring(0, 12)}`;

      resources.push({
        title: `Service > ${serviceName}${modelName}`,
        icon: 'fas fa-rocket',
        command: SERVICE_NAVIGATE_COMMAND,
        id: containerId,
        hidden: false,
      });
    });

    const conversations: Conversation[] = this.playgroundManager.getConversations();
    conversations.forEach((conversation: Conversation) => {
      resources.push({
        title: `Playground > ${conversation.name}`,
        icon: 'fas fa-message',
        command: PLAYGROUND_NAVIGATE_COMMAND,
        id: conversation.id,
        hidden: false,
      });
    });

    const models: ModelInfo[] = this.modelsManager.getModelsInfo();
    models.forEach((model: ModelInfo) => {
      resources.push({
        title: `Model > ${model.name}`,
        icon: 'fas fa-book-open',
        command: MODEL_NAVIGATE_COMMAND,
        id: model.id,
        hidden: true,
      });
    });

    const recipes: Recipe[] = this.catalogManager.getRecipes();
    recipes.forEach((recipe: Recipe) => {
      resources.push({
        title: `Recipe > ${recipe.name}`,
        icon: 'fas fa-book-open',
        command: RECIPE_NAVIGATE_COMMAND,
        id: recipe.id,
        hidden: true,
      });
    });

    return resources;
  }
}
