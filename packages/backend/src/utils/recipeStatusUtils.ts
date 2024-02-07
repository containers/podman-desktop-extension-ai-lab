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

import type { RecipeStatus, RecipeStatusState } from '@shared/src/models/IRecipeStatus';
import type { Task, TaskState } from '@shared/src/models/ITask';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';

export class RecipeStatusUtils {
  private tasks: Map<string, Task> = new Map<string, Task>();
  private state: RecipeStatusState = 'loading';

  constructor(
    private recipeId: string,
    private recipeStatusRegistry: RecipeStatusRegistry,
  ) {}

  update() {
    this.recipeStatusRegistry.setStatus(this.recipeId, this.toRecipeStatus());
  }

  setStatus(state: RecipeStatusState): void {
    this.state = state;
    this.update();
  }

  setTask(task: Task) {
    this.tasks.set(task.id, task);

    if (task.state === 'error') this.setStatus('error');

    this.update();
  }

  setTaskError(taskId: string, error: string) {
    if (!this.tasks.has(taskId)) throw new Error('task not found.');
    const task = this.tasks.get(taskId);
    this.setTask({
      // we place the error before, as we do not want to overwrite any existing error (we try to keep the first one)
      error: error,
      ...task,
      state: 'error',
    });
  }

  /**
   * @param taskId the identifier of the task
   * @param state the state of the task, cannot be error use setTaskError if an error occurs
   */
  setTaskState(taskId: string, state: 'loading' | 'success') {
    if (!this.tasks.has(taskId)) throw new Error('task not found.');
    const task = this.tasks.get(taskId);
    this.setTask({
      ...task,
      state: state,
    });
  }

  setTaskProgress(taskId: string, value: number) {
    if (!this.tasks.has(taskId)) throw new Error('task not found.');
    const task = this.tasks.get(taskId);
    this.setTask({
      ...task,
      progress: value,
    });
  }

  toRecipeStatus(): RecipeStatus {
    return {
      recipeId: this.recipeId,
      state: this.state,
      tasks: Array.from(this.tasks.values()),
    };
  }
}
