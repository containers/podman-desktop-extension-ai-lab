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

import '@testing-library/jest-dom/vitest';
import { test, expect, describe, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';

vi.mock('../../utils/client', async () => {
  return {
    studioClient: {
      requestCancelToken: vi.fn(),
    },
  };
});

test('TasksProgress should not renderer any tasks', async () => {
  // render the component
  render(TasksProgress, { tasks: [] });

  const items = screen.queryAllByRole('listitem');
  expect(items).toBeDefined();
  expect(items.length).toBe(0);
});

test('TasksProgress should renderer one tasks', async () => {
  // render the component
  render(TasksProgress, {
    tasks: [
      {
        id: 'random',
        state: 'success',
        name: 'random',
      },
    ],
  });

  const items = screen.queryAllByRole('listitem');
  expect(items).toBeDefined();
  expect(items.length).toBe(1);
});

test('TasksProgress should renderer multiple tasks', async () => {
  // render the component
  render(TasksProgress, {
    tasks: [
      {
        id: 'random',
        state: 'success',
        name: 'random',
      },
      {
        id: 'random-2',
        state: 'error',
        name: 'random',
      },
    ],
  });

  const items = screen.queryAllByRole('listitem');
  expect(items).toBeDefined();
  expect(items.length).toBe(2);
});

describe('tasks types', () => {
  test('TasksProgress should renderer success task', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'success',
          name: 'random',
        },
      ],
    });

    const item = screen.getByRole('img');
    expect(item).toHaveClass('text-green-500');
    expect(item).not.toHaveClass('animate-spin');
  });

  test('TasksProgress should renderer loading task', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'loading',
          name: 'random',
        },
      ],
    });

    const item = screen.getByRole('img');
    expect(item).toHaveClass('fill-purple-500');
    expect(item).toHaveClass('animate-spin');
  });

  test('TasksProgress should renderer error task', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'error',
          name: 'random',
        },
      ],
    });

    const item = screen.getByRole('img');
    expect(item).toHaveClass('text-red-600');
    expect(item).not.toHaveClass('animate-spin');
  });
});

describe('error expandable', () => {
  test('TasksProgress should renderer one error task without expandable error message', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'error',
          name: 'random',
        },
      ],
    });

    const message = screen.queryByText('View Error');
    expect(message).toBeNull();
  });

  test('TasksProgress should renderer one error task without showing error message', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'error',
          name: 'random',
          error: 'message about error.',
        },
      ],
    });

    const message = screen.queryByText('View Error');
    expect(message).toBeDefined();
    const note = screen.getByRole('note');
    expect(note).toHaveClass('hidden');
  });

  test('TasksProgress should renderer one error task and show error message on click', async () => {
    // render the component
    render(TasksProgress, {
      tasks: [
        {
          id: 'random',
          state: 'error',
          name: 'random',
          error: 'message about error.',
        },
      ],
    });

    const message = screen.getByText('View Error');
    await fireEvent.click(message);

    const note = screen.getByRole('note');
    await waitFor(() => {
      expect(note).not.toHaveClass('hidden');
    });
  });
});
