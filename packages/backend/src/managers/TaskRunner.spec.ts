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

import { beforeEach, expect, test, vi } from 'vitest';
import type { TaskRegistry } from '../registries/TaskRegistry';
import { TaskRunner } from './TaskRunner';
import type { TaskRunnerTools } from '../models/TaskRunner';
import type { Task } from '@shared/models/ITask';

const taskRegistry = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTasksByLabels: vi.fn(),
} as unknown as TaskRegistry;

const runner = vi.fn<(tools: TaskRunnerTools) => Promise<void>>();

let taskRunner: TaskRunner;

beforeEach(() => {
  vi.resetAllMocks();
  taskRunner = new TaskRunner(taskRegistry);
});

test('runner terminates with no successLabel', async () => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  runner.mockResolvedValue();
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await taskRunner.runAsTask(
    labels,
    {
      loadingLabel: 'Loading...',
      errorMsg: err => `an error: ${err}`,
    },
    runner,
  );

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Loading...',
    state: 'success',
  });
});

test('runner terminates with successLabel', async () => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  runner.mockResolvedValue();
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await taskRunner.runAsTask(
    labels,
    {
      loadingLabel: 'Loading...',
      successLabel: 'Success!!',
      errorMsg: err => `an error: ${err}`,
    },
    runner,
  );

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Success!!',
    state: 'success',
  });
});

test('runner throws with no errorLabel', async () => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  runner.mockRejectedValue('something goes wrong');
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await expect(() =>
    taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Loading...',
        errorMsg: err => `an error: ${err}`,
      },
      runner,
    ),
  ).rejects.toThrow();

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Loading...',
    state: 'error',
    error: 'an error: something goes wrong',
  });
});

test('runner throws with errorLabel', async () => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  runner.mockRejectedValue('something goes wrong');
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await expect(() =>
    taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Loading...',
        errorLabel: 'Failed :(',
        errorMsg: err => `an error: ${err}`,
      },
      runner,
    ),
  ).rejects.toThrow();

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Failed :(',
    state: 'error',
    error: 'an error: something goes wrong',
  });
});

test('updateLabels', async () => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  runner.mockImplementation(async ({ updateLabels }) => {
    updateLabels(labels => ({ ...labels, newLabel: 'newValue' }));
  });
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await taskRunner.runAsTask(
    labels,
    {
      loadingLabel: 'Loading...',
      errorMsg: err => `an error: ${err}`,
    },
    runner,
  );

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Loading...',
    state: 'success',
    labels: {
      label1: 'value1',
      label2: 'value2',
      newLabel: 'newValue',
    },
  });
  expect(taskRegistry.updateTask).toHaveBeenCalledWith({
    id: 'task1',
    name: 'Loading...',
    state: 'success',
    labels: {
      label1: 'value1',
      label2: 'value2',
      newLabel: 'newValue',
    },
  });
});

test.each<{ setError: boolean }>([
  {
    setError: true,
  },
  {
    setError: false,
  },
])('setErrorForSubtasksOnError $setError', async ({ setError }) => {
  vi.mocked(taskRegistry.createTask).mockReturnValue({
    id: 'task1',
    name: 'Loading...',
    state: 'loading',
  });
  const otherTasks: Task[] = [
    {
      id: 'subtask1',
      name: 'Sub task 1',
      state: 'loading',
    },
    {
      id: 'subtask2',
      name: 'Sub task 2',
      state: 'loading',
    },
    {
      id: 'subtask3',
      name: 'Sub task 3',
      state: 'error',
    },
  ];
  vi.mocked(taskRegistry.getTasksByLabels).mockReturnValue(otherTasks);
  runner.mockRejectedValue('something goes wrong');
  const labels = {
    label1: 'value1',
    label2: 'value2',
  };
  await expect(() =>
    taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Loading...',
        errorMsg: err => `an error: ${err}`,
        setErrorForSubtasksOnError: setError,
      },
      runner,
    ),
  ).rejects.toThrow();

  expect(taskRegistry.createTask).toHaveBeenCalledWith('Loading...', 'loading', labels);
  if (setError) {
    expect(taskRegistry.updateTask).toHaveBeenCalledTimes(3);
    expect(taskRegistry.updateTask).toHaveBeenNthCalledWith(1, { ...otherTasks[0], state: 'error' });
    expect(taskRegistry.updateTask).toHaveBeenNthCalledWith(2, { ...otherTasks[1], state: 'error' });
    expect(taskRegistry.updateTask).toHaveBeenNthCalledWith(3, {
      id: 'task1',
      name: 'Loading...',
      state: 'error',
      error: 'an error: something goes wrong',
    });
  } else {
    expect(taskRegistry.updateTask).toHaveBeenCalledExactlyOnceWith({
      id: 'task1',
      name: 'Loading...',
      state: 'error',
      error: 'an error: something goes wrong',
    });
  }
});
