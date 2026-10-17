/**********************************************************************
 * Copyright (C) 2024-2026 Red Hat, Inc.
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
import { type Disposable, navigation, type WebviewPanel, commands } from '@podman-desktop/api';
import { MSG_NAVIGATION_ROUTE_UPDATE } from '@shared/Messages';
import type { RpcExtension } from '@shared/messages/MessageProxy';

// Route identifiers and commands
export const DASHBOARD_ROUTE = 'dashboard';
export const DASHBOARD_NAVIGATE_COMMAND = 'ai-lab.navigation.dashboard';

export const RECIPES_ROUTE = 'recipes';
export const RECIPES_NAVIGATE_COMMAND = 'ai-lab.navigation.recipes';

export const RECIPE_START_ROUTE = 'recipe.start';
export const RECIPE_START_NAVIGATE_COMMAND = 'ai-lab.navigation.recipe.start';

export const APPLICATIONS_ROUTE = 'applications';
export const APPLICATIONS_NAVIGATE_COMMAND = 'ai-lab.navigation.applications';

export const MODELS_ROUTE = 'models';
export const MODELS_NAVIGATE_COMMAND = 'ai-lab.navigation.models';

export const PLAYGROUNDS_ROUTE = 'playgrounds';
export const PLAYGROUNDS_NAVIGATE_COMMAND = 'ai-lab.navigation.playgrounds';

export const SERVICES_ROUTE = 'services';
export const SERVICES_NAVIGATE_COMMAND = 'ai-lab.navigation.services';

export const INFERENCE_CREATE_ROUTE = 'inference.create';
export const INFERENCE_CREATE_NAVIGATE_COMMAND = 'ai-lab.navigation.inference.create';

export const LLAMASTACK_ROUTE = 'llamastack';
export const LLAMASTACK_NAVIGATE_COMMAND = 'ai-lab.navigation.llamastack';

export const LOCAL_SERVER_ROUTE = 'localserver';
export const LOCAL_SERVER_NAVIGATE_COMMAND = 'ai-lab.navigation.localserver';

export const ABOUT_INSTRUCTLAB_ROUTE = 'about-instructlab';
export const ABOUT_INSTRUCTLAB_NAVIGATE_COMMAND = 'ai-lab.navigation.about-instructlab';

export const INSTRUCTLAB_ROUTE = 'instructlab';
export const INSTRUCTLAB_NAVIGATE_COMMAND = 'ai-lab.navigation.instructlab';

export const SERVICE_NAVIGATE_COMMAND = 'ai-lab.navigation.service';
export const PLAYGROUND_NAVIGATE_COMMAND = 'ai-lab.navigation.playground';
export const RECIPE_NAVIGATE_COMMAND = 'ai-lab.navigation.recipe';
export const MODEL_NAVIGATE_COMMAND = 'ai-lab.navigation.model';

export class NavigationRegistry implements Disposable {
  #disposables: Disposable[] = [];
  #route: string | undefined = undefined;

  constructor(
    private panel: WebviewPanel,
    private rpcExtension: RpcExtension,
  ) {}

  init(): void {
    if (!navigation.register) {
      console.warn('this version of podman-desktop do not support task actions: some feature will not be available.');
      return;
    }

    // register the recipes start navigation and command
    this.#disposables.push(
      commands.registerCommand(RECIPE_START_NAVIGATE_COMMAND, this.navigateToRecipeStart.bind(this)),
    );
    this.#disposables.push(navigation.register(RECIPE_START_ROUTE, RECIPE_START_NAVIGATE_COMMAND));

    // register the inference create navigation and command
    this.#disposables.push(
      commands.registerCommand(INFERENCE_CREATE_NAVIGATE_COMMAND, this.navigateToInferenceCreate.bind(this)),
    );
    this.#disposables.push(navigation.register(INFERENCE_CREATE_ROUTE, INFERENCE_CREATE_NAVIGATE_COMMAND));

    // Register Dashboard
    this.#disposables.push(commands.registerCommand(DASHBOARD_NAVIGATE_COMMAND, this.navigateToDashboard.bind(this)));
    this.#disposables.push(
      navigation.register(DASHBOARD_ROUTE, DASHBOARD_NAVIGATE_COMMAND, {
        title: 'Dashboard',
        icon: 'fas fa-house',
      }),
    );

    // Register Recipes Catalog
    this.#disposables.push(commands.registerCommand(RECIPES_NAVIGATE_COMMAND, this.navigateToRecipes.bind(this)));
    this.#disposables.push(
      navigation.register(RECIPES_ROUTE, RECIPES_NAVIGATE_COMMAND, {
        title: 'Recipe Catalog',
        icon: 'fas fa-book-open',
      }),
    );

    // Register Applications
    this.#disposables.push(
      commands.registerCommand(APPLICATIONS_NAVIGATE_COMMAND, this.navigateToApplications.bind(this)),
    );
    this.#disposables.push(
      navigation.register(APPLICATIONS_ROUTE, APPLICATIONS_NAVIGATE_COMMAND, {
        title: 'Running',
        icon: 'fas fa-server',
      }),
    );

    // Register Models Catalog
    this.#disposables.push(commands.registerCommand(MODELS_NAVIGATE_COMMAND, this.navigateToModels.bind(this)));
    this.#disposables.push(
      navigation.register(MODELS_ROUTE, MODELS_NAVIGATE_COMMAND, {
        title: 'Catalog',
        icon: 'fas fa-book-open',
      }),
    );

    // Register Services
    this.#disposables.push(commands.registerCommand(SERVICES_NAVIGATE_COMMAND, this.navigateToServices.bind(this)));
    this.#disposables.push(
      navigation.register(SERVICES_ROUTE, SERVICES_NAVIGATE_COMMAND, {
        title: 'Services',
        icon: 'fas fa-rocket',
      }),
    );

    // Register Playgrounds
    this.#disposables.push(
      commands.registerCommand(PLAYGROUNDS_NAVIGATE_COMMAND, this.navigateToPlaygrounds.bind(this)),
    );
    this.#disposables.push(
      navigation.register(PLAYGROUNDS_ROUTE, PLAYGROUNDS_NAVIGATE_COMMAND, {
        title: 'Playgrounds',
        icon: 'fas fa-message',
      }),
    );

    // Register Llama Stack
    this.#disposables.push(commands.registerCommand(LLAMASTACK_NAVIGATE_COMMAND, this.navigateToLlamaStack.bind(this)));
    this.#disposables.push(
      navigation.register(LLAMASTACK_ROUTE, LLAMASTACK_NAVIGATE_COMMAND, {
        title: 'Llama Stack',
        icon: 'fas fa-rocket',
      }),
    );

    // Register Local Server
    this.#disposables.push(
      commands.registerCommand(LOCAL_SERVER_NAVIGATE_COMMAND, this.navigateToLocalServer.bind(this)),
    );
    this.#disposables.push(
      navigation.register(LOCAL_SERVER_ROUTE, LOCAL_SERVER_NAVIGATE_COMMAND, {
        title: 'Local Server',
        icon: 'fas fa-gear',
      }),
    );

    // Register About InstructLab
    this.#disposables.push(
      commands.registerCommand(ABOUT_INSTRUCTLAB_NAVIGATE_COMMAND, this.navigateToAboutInstructLab.bind(this)),
    );
    this.#disposables.push(
      navigation.register(ABOUT_INSTRUCTLAB_ROUTE, ABOUT_INSTRUCTLAB_NAVIGATE_COMMAND, {
        title: 'About InstructLab',
        icon: 'fas fa-info-circle',
      }),
    );

    // Register InstructLab
    this.#disposables.push(
      commands.registerCommand(INSTRUCTLAB_NAVIGATE_COMMAND, this.navigateToInstructLab.bind(this)),
    );
    this.#disposables.push(
      navigation.register(INSTRUCTLAB_ROUTE, INSTRUCTLAB_NAVIGATE_COMMAND, {
        title: 'Try InstructLab',
        icon: 'fas fa-circle-down',
      }),
    );

    // Register navigation commands for resources
    this.#disposables.push(commands.registerCommand(SERVICE_NAVIGATE_COMMAND, this.navigateToService.bind(this)));
    this.#disposables.push(commands.registerCommand(PLAYGROUND_NAVIGATE_COMMAND, this.navigateToPlayground.bind(this)));
    this.#disposables.push(commands.registerCommand(RECIPE_NAVIGATE_COMMAND, this.navigateToRecipe.bind(this)));
    this.#disposables.push(commands.registerCommand(MODEL_NAVIGATE_COMMAND, this.navigateToModel.bind(this)));
  }

  /**
   * This function return the route, and reset it.
   * Meaning after read the route is undefined
   */
  public readRoute(): string | undefined {
    const result: string | undefined = this.#route;
    this.#route = undefined;
    return result;
  }

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  protected async updateRoute(route: string): Promise<void> {
    await this.rpcExtension.fire(MSG_NAVIGATION_ROUTE_UPDATE, route);
    this.#route = route;
    this.panel.reveal();
  }

  public async navigateToDashboard(): Promise<void> {
    return this.updateRoute('/');
  }

  public async navigateToRecipes(): Promise<void> {
    return this.updateRoute('/recipes');
  }

  public async navigateToRecipeStart(recipeId: string, trackingId: string): Promise<void> {
    return this.updateRoute(`/recipe/${recipeId}/start?trackingId=${trackingId}`);
  }

  public async navigateToApplications(): Promise<void> {
    return this.updateRoute('/applications');
  }

  public async navigateToModels(): Promise<void> {
    return this.updateRoute('/models');
  }

  public async navigateToPlaygrounds(): Promise<void> {
    return this.updateRoute('/playgrounds');
  }

  public async navigateToServices(): Promise<void> {
    return this.updateRoute('/services');
  }

  public async navigateToInferenceCreate(trackingId: string): Promise<void> {
    return this.updateRoute(`/service/create?trackingId=${trackingId}`);
  }

  public async navigateToLlamaStack(): Promise<void> {
    return this.updateRoute('/llamastack/try');
  }

  public async navigateToInstructLab(): Promise<void> {
    return this.updateRoute('/instructlab/try');
  }

  public async navigateToAboutInstructLab(): Promise<void> {
    return this.updateRoute('/about-instructlab');
  }

  public async navigateToLocalServer(): Promise<void> {
    return this.updateRoute('/local-server');
  }

  public async navigateToService(id: string): Promise<void> {
    return this.updateRoute(`/service/${id}`);
  }

  public async navigateToPlayground(id: string): Promise<void> {
    return this.updateRoute(`/playground/${id}`);
  }

  public async navigateToRecipe(id: string): Promise<void> {
    return this.updateRoute(`/recipe/${id}`);
  }

  public async navigateToModel(id: string): Promise<void> {
    return this.updateRoute(`/model/${id}`);
  }
}
