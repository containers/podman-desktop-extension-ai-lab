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
import { test, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TrackedTasks from '/@/lib/progress/TrackedTasks.svelte';

vi.mock('../../utils/client', () => ({
  studioClient: {
    requestCancelToken: vi.fn(),
  },
}));

test('empty task should not have any content', async () => {
  const { queryByRole } = render(TrackedTasks, {
    tasks: [],
  });

  const status = queryByRole('status');
  expect(status).toBeNull();
});

test('task without matching trackingId should not have any content', async () => {
  const { queryByRole } = render(TrackedTasks, {
    tasks: [
      {
        id: 'dummy-id',
        name: 'Hello World',
        state: 'loading',
        labels: {
          trackingId: 'dummyTrackingId',
        },
      },
    ],
    trackingId: 'notMatching',
  });

  const status = queryByRole('status');
  expect(status).toBeNull();
});

test('task with matching trackingId should be visible', () => {
  const { getByRole } = render(TrackedTasks, {
    tasks: [
      {
        id: 'dummy-id',
        name: 'Hello World',
        state: 'loading',
        labels: {
          trackingId: 'dummyTrackingId',
        },
      },
    ],
    trackingId: 'dummyTrackingId',
  });

  const status = getByRole('status');
  expect(status).toBeInTheDocument();
});

test('onChange should provide task with matching trackingId', () => {
  const onChangeMock = vi.fn();
  render(TrackedTasks, {
    tasks: [
      {
        id: 'dummy-id',
        name: 'Hello World',
        state: 'loading',
        labels: {
          trackingId: 'dummyTrackingId',
        },
      },
      {
        id: 'dummy-id-2',
        name: 'Hello World 2',
        state: 'loading',
      },
    ],
    trackingId: 'dummyTrackingId',
    onChange: onChangeMock,
  });

  expect(onChangeMock).toHaveBeenCalledWith([
    {
      id: 'dummy-id',
      name: 'Hello World',
      state: 'loading',
      labels: {
        trackingId: 'dummyTrackingId',
      },
    },
  ]);
});
