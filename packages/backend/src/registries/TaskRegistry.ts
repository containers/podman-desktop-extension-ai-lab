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

import type { Task, TaskState } from '@shared/src/models/ITask';
import { MSG_TASKS_UPDATE } from '@shared/Messages';
import type { Webview } from '@podman-desktop/api';

/**
 * A registry for managing tasks.
 */
export class TaskRegistry {
  private counter: number = 0;
  private tasks: Map<string, Task> = new Map<string, Task>();

  /**
   * Constructs a new TaskRegistry.
   * @param webview The webview instance to use for communication.
   */
  constructor(private webview: Webview) {}

  /**
   * Retrieves a task by its ID.
   * @param id The ID of the task to retrieve.
   * @returns The task with the specified ID, or undefined if not found.
   */
  get(id: string): Task | undefined {
    if (this.tasks.has(id)) return this.tasks.get(id);
    return undefined;
  }

  /**
   * Creates a new task.
   * @param name The name of the task.
   * @param state The initial state of the task.
   * @param labels Optional labels for the task.
   * @returns The newly created task.
   */
  createTask(name: string, state: TaskState, labels: { [id: string]: string } = {}): Task {
    const task = {
      id: `task-${++this.counter}`,
      name: name,
      state: state,
      labels: labels,
    };
    this.tasks.set(task.id, task);
    this.notify();
    return task;
  }

  /**
   * Updates an existing task.
   * @param task The task to update.
   * @throws Error if the task with the specified ID does not exist.
   */
  updateTask(task: Task) {
    if (!this.tasks.has(task.id)) throw new Error(`Task with id ${task.id} does not exist.`);
    this.tasks.set(task.id, {
      ...task,
      state: task.error !== undefined ? 'error' : task.state, // enforce error state when error is defined
    });
    this.notify();
  }

  /**
   * Deletes a task by its ID.
   * @param taskId The ID of the task to delete.
   */
  delete(taskId: string) {
    this.deleteAll([taskId]);
  }

  /**
   * Deletes multiple tasks by their IDs.
   * @param taskIds The IDs of the tasks to delete.
   */
  deleteAll(taskIds: string[]) {
    taskIds.map(taskId => this.tasks.delete(taskId));
    this.notify();
  }

  /**
   * Retrieves all tasks.
   * @returns An array of all tasks.
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Retrieves tasks that match the specified labels.
   * @param requestedLabels The labels to match against.
   * @returns An array of tasks that match the specified labels.
   */
  getTasksByLabels(requestedLabels: { [key: string]: string }): Task[] {
    return this.getTasks().filter(task => this.filter(task, requestedLabels));
  }

  findTaskByLabels(requestedLabels: { [key: string]: string }): Task | undefined {
    return this.getTasks().find(task => this.filter(task, requestedLabels));
  }

  private filter(task: Task, requestedLabels: { [key: string]: string }): boolean {
    const labels = task.labels;
    if (labels === undefined) return false;

    for (const [key, value] of Object.entries(requestedLabels)) {
      if (!(key in labels) || labels[key] !== value) return false;
    }

    return true;
  }

  /**
   * Deletes tasks that match the specified labels.
   * @param labels The labels to match against for deletion.
   */
  deleteByLabels(labels: { [key: string]: string }): void {
    this.deleteAll(this.getTasksByLabels(labels).map(task => task.id));
  }

  private notify() {
    this.webview
      .postMessage({
        id: MSG_TASKS_UPDATE,
        body: this.getTasks(),
      })
      .catch((err: unknown) => {
        console.error('error notifying tasks', err);
      });
  }
}
