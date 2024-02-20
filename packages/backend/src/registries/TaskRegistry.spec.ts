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
import { beforeEach, expect, test, vi } from 'vitest';
import type { Webview } from '@podman-desktop/api';
import { TaskRegistry } from './TaskRegistry';

const mocks = vi.hoisted(() => ({
  postMessageMock: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.postMessageMock.mockResolvedValue(undefined);
});

test('should not have any tasks by default', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);
  expect(taskRegistry.getTasks().length).toBe(0);
});

test('should notify when create task', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);

  taskRegistry.createTask('random', 'loading');

  expect(mocks.postMessageMock).toHaveBeenCalled();
});

test('should notify when update task', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);

  const task = taskRegistry.createTask('random', 'loading');
  taskRegistry.updateTask(task);

  expect(mocks.postMessageMock).toHaveBeenCalledTimes(2);
});

test('should get tasks by label', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);

  taskRegistry.createTask('random-1', 'loading', { index: '1' });
  taskRegistry.createTask('random-2', 'loading', { index: '2' });

  const tasksWithIndex1 = taskRegistry.getTasksByLabels({ index: '1' });
  const tasksWithIndex2 = taskRegistry.getTasksByLabels({ index: '2' });

  expect(tasksWithIndex1.length).toBe(1);
  expect(tasksWithIndex2.length).toBe(1);
  expect(tasksWithIndex1[0].name).toBe('random-1');
  expect(tasksWithIndex2[0].name).toBe('random-2');
});

test('should delete tasks by label', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);

  taskRegistry.createTask('random-1', 'loading', { index: '1' });
  taskRegistry.createTask('random-2', 'loading', { index: '2' });

  taskRegistry.deleteByLabels({ index: '1' });

  expect(taskRegistry.getTasks().length).toBe(1);
  expect(taskRegistry.getTasks()[0].name).toBe('random-2');
});

test('should get tasks by multiple labels', () => {
  const taskRegistry = new TaskRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);

  taskRegistry.createTask('task-1', 'loading', { type: 'A', priority: 'high' });
  taskRegistry.createTask('task-2', 'loading', { type: 'B', priority: 'low' });
  taskRegistry.createTask('task-3', 'loading', { type: 'A', priority: 'medium' });

  const tasksWithTypeA = taskRegistry.getTasksByLabels({ type: 'A' });
  const tasksWithHighPriority = taskRegistry.getTasksByLabels({ priority: 'high' });
  const tasksWithTypeAAndHighPriority = taskRegistry.getTasksByLabels({ type: 'A', priority: 'high' });

  expect(tasksWithTypeA.length).toBe(2);
  expect(tasksWithHighPriority.length).toBe(1);
  expect(tasksWithTypeAAndHighPriority.length).toBe(1);
  expect(tasksWithTypeAAndHighPriority[0].name).toBe('task-1');
});
