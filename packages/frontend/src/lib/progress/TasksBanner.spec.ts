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

import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TasksBanner from '/@/lib/progress/TasksBanner.svelte';

vi.mock('../../utils/client', async () => {
  return {
    studioClient: {},
  };
});

const mocks = vi.hoisted(() => {
  return {
    // tasks store
    getTasksMock: vi.fn(),
  };
});

vi.mock('../../stores/tasks', async () => {
  return {
    tasks: {
      subscribe: (f: (msg: unknown) => void) => {
        f(mocks.getTasksMock());
        return (): void => {};
      },
    },
  };
});

test('expect all tasks to be displayed', () => {
  mocks.getTasksMock.mockReturnValue([
    {
      state: 'loading',
      labels: {},
      name: 'Task-1',
      id: 'task-1',
    },
    {
      state: 'loading',
      labels: {},
      name: 'Task-2',
      id: 'task-2',
    },
  ]);

  render(TasksBanner, { labels: {}, title: 'Tasks list' });

  expect(screen.getByText('Task-1')).toBeDefined();
  expect(screen.getByText('Task-2')).toBeDefined();
});

test('expect loading tasks to be displayed', () => {
  mocks.getTasksMock.mockReturnValue([
    {
      state: 'loading',
      labels: {},
      name: 'Task-1',
      id: 'task-1',
    },
    {
      state: 'success',
      labels: {},
      name: 'Task-2',
      id: 'task-2',
    },
  ]);

  render(TasksBanner, { labels: {}, title: 'Tasks list' });

  expect(screen.getByText('Task-1')).toBeDefined();
  expect(screen.queryByText('Task-2')).toBeNull();
});

test('expect tasks with specified labels to be displayed', () => {
  mocks.getTasksMock.mockReturnValue([
    {
      state: 'loading',
      labels: {
        hello: 'world',
      },
      name: 'Task-1',
      id: 'task-1',
    },
    {
      state: 'loading',
      labels: {},
      name: 'Task-2',
      id: 'task-2',
    },
  ]);

  render(TasksBanner, { labels: { hello: undefined }, title: 'Tasks list' });

  expect(screen.getByText('Task-1')).toBeDefined();
  expect(screen.queryByText('Task-2')).toBeNull();
});

test('expect tasks with specified pair label/value to be displayed', () => {
  mocks.getTasksMock.mockReturnValue([
    {
      state: 'loading',
      labels: {
        hello: 'saturn',
      },
      name: 'Task-1',
      id: 'task-1',
    },
    {
      state: 'loading',
      labels: {
        hello: 'world',
      },
      name: 'Task-2',
      id: 'task-2',
    },
  ]);

  render(TasksBanner, { labels: { hello: 'world' }, title: 'Tasks list' });

  expect(screen.queryByText('Task-1')).toBeNull();
  expect(screen.getByText('Task-2')).toBeDefined();
});

test('expect tasks with specified pairs labels/values to be displayed', () => {
  mocks.getTasksMock.mockReturnValue([
    {
      state: 'loading',
      labels: {
        hello: 'saturn',
        dummy: 'hello',
      },
      name: 'Task-1',
      id: 'task-1',
    },
    {
      state: 'loading',
      labels: {
        hello: 'saturn',
      },
      name: 'Task-2',
      id: 'task-2',
    },
  ]);

  render(TasksBanner, { labels: { hello: 'saturn', dummy: 'hello' }, title: 'Tasks list' });

  expect(screen.getByText('Task-1')).toBeDefined();
  expect(screen.queryByText('Task-2')).toBeNull();
});
