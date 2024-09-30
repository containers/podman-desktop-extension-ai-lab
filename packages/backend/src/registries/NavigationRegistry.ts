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
import { type Disposable, navigation, type WebviewPanel, commands } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';

export const RECIPE_START_ROUTE = 'recipe.start';
export const RECIPE_START_NAVIGATE_COMMAND = 'ai-lab.navigation.recipe.start';

export const INFERENCE_CREATE_ROUTE = 'inference.create';
export const INFERENCE_CREATE_NAVIGATE_COMMAND = 'ai-lab.navigation.inference.create';

export class NavigationRegistry implements Disposable {
  #disposables: Disposable[] = [];
  #route: string | undefined = undefined;

  constructor(private panel: WebviewPanel) {}

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
    await this.panel.webview.postMessage({
      id: Messages.MSG_NAVIGATION_ROUTE_UPDATE,
      body: route,
    });
    this.#route = route;
    this.panel.reveal();
  }

  public async navigateToRecipeStart(recipeId: string, trackingId: string): Promise<void> {
    return this.updateRoute(`/recipe/${recipeId}/start?trackingId=${trackingId}`);
  }

  public async navigateToInferenceCreate(trackingId: string): Promise<void> {
    return this.updateRoute(`/service/create?trackingId=${trackingId}`);
  }
}
