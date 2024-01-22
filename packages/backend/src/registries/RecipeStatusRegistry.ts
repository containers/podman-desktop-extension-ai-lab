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

import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';
import type { TaskRegistry } from './TaskRegistry';
import type { Webview } from '@podman-desktop/api';
import { MSG_NEW_RECIPE_STATE } from '@shared/Messages';

export class RecipeStatusRegistry {
  private statuses: Map<string, RecipeStatus> = new Map<string, RecipeStatus>();

  constructor(
    private taskRegistry: TaskRegistry,
    private webview: Webview,
  ) {}

  setStatus(recipeId: string, status: RecipeStatus) {
    // Update the TaskRegistry
    if (status.tasks && status.tasks.length > 0) {
      status.tasks.map(task => this.taskRegistry.set(task));
    }
    this.statuses.set(recipeId, status);
    this.dispatchState().catch((err: unknown) => {
      console.error('error dispatching recipe statuses', err);
    }); // we don't want to wait
  }

  getStatus(recipeId: string): RecipeStatus | undefined {
    return this.statuses.get(recipeId);
  }

  getStatuses(): Map<string, RecipeStatus> {
    return this.statuses;
  }

  private async dispatchState() {
    await this.webview.postMessage({
      id: MSG_NEW_RECIPE_STATE,
      body: this.statuses,
    });
  }
}
