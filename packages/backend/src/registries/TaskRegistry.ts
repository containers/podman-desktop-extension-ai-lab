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

import type { Task } from '@shared/src/models/ITask';
import { MSG_TASKS_UPDATE } from '@shared/Messages';
import type { Webview } from '@podman-desktop/api';

export class TaskRegistry {
  private tasks: Map<string, Task> = new Map<string, Task>();

  constructor(private webview: Webview) {}

  get(id: string): Task | undefined {
    if(this.tasks.has(id))
      return this.tasks.get(id);
    return undefined;
  }

  set(task: Task) {
    this.tasks.set(task.id, task);
    this.notify();
  }

  delete(taskId: string) {
    this.tasks.delete(taskId);
    this.notify();
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  private notify() {
    this.webview.postMessage({
      id: MSG_TASKS_UPDATE,
      body: this.getTasks(),
    }).catch((err: unknown) => {
      console.error('error notifying tasks', err);
    });
  }
}
