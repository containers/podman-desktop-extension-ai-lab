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
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TaskItem from '/@/lib/progress/TaskItem.svelte';
import { studioClient } from '/@/utils/client';

vi.mock('../../utils/client', async () => {
  return {
    studioClient: {
      requestCancelToken: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.requestCancelToken).mockResolvedValue(undefined);
});

test('Task item should no show cancel button if no cancellation token provided', async () => {
  // render the component
  render(TaskItem, {
    task: {
      name: 'dummyName',
      state: 'loading',
      id: 'dummyId',
    },
  });

  const cancelBtn = screen.queryByTitle('Cancel');
  expect(cancelBtn).toBeNull();
});

test('Task item should no show cancel button if state not loading', async () => {
  // render the component
  render(TaskItem, {
    task: {
      name: 'dummyName',
      state: 'success',
      id: 'dummyId',
      cancellationToken: 1,
    },
  });

  const cancelBtn = screen.queryByTitle('Cancel');
  expect(cancelBtn).toBeNull();
});

test('Task item should show cancel button if state loading and cancellation token provided', async () => {
  // render the component
  render(TaskItem, {
    task: {
      name: 'dummyName',
      state: 'loading',
      id: 'dummyId',
      cancellationToken: 1,
    },
  });

  const cancelBtn = screen.getByTitle('Cancel');
  expect(cancelBtn).toBeDefined();

  await fireEvent.click(cancelBtn);

  expect(studioClient.requestCancelToken).toHaveBeenCalledWith(1);
});
