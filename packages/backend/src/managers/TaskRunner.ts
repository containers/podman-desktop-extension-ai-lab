/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import type { RunAsTaskOptions, TaskRunnerTools } from '../models/TaskRunner';
import type { TaskRegistry } from '../registries/TaskRegistry';

export class TaskRunner {
  constructor(private taskRegistry: TaskRegistry) {}

  async runAsTask<T>(
    labels: Record<string, string>,
    options: RunAsTaskOptions,
    run: (tools: TaskRunnerTools) => Promise<T>,
  ): Promise<T> {
    const tools = {
      updateLabels: (f: (labels: Record<string, string>) => Record<string, string>): void => {
        task.labels = f(labels);
        this.taskRegistry.updateTask(task);
      },
    };

    const task = this.taskRegistry.createTask(options.loadingLabel, 'loading', labels);
    try {
      const result = await run(tools);
      task.state = 'success';
      if (options.successLabel) {
        task.name = options.successLabel;
      }
      return result;
    } catch (err: unknown) {
      task.state = 'error';
      task.error = options.errorMsg(err);
      if (options.errorLabel) {
        task.name = options.errorLabel;
      }
      throw err;
    } finally {
      task.progress = undefined;
      this.taskRegistry.updateTask(task);
    }
  }
}
