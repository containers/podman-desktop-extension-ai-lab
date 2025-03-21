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
import { screen, render, waitFor, within } from '@testing-library/svelte';
import { router } from 'tinro';
import TuneSessions from './TuneSessions.svelte';
import type { InstructlabSession } from '@shared/models/instructlab/IInstructlabSession';
import type { ApplicationCatalog } from '@shared/models/IApplicationCatalog';

const mocks = vi.hoisted(() => ({
  instructlabSessionsListMock: vi.fn(),
  getCatalogMock: vi.fn(),
}));

vi.mock('../stores/instructlabSessions', () => ({
  instructlabSessions: {
    subscribe: (f: (msg: InstructlabSession[]) => void) => {
      f(mocks.instructlabSessionsListMock());
      return (): void => {};
    },
  },
}));

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
    },
    rpcBrowser: {
      subscribe: (): unknown => {
        return {
          unsubscribe: (): void => {},
        };
      },
    },
  };
});

test('should display empty screen', async () => {
  const sessions: InstructlabSession[] = [];
  mocks.instructlabSessionsListMock.mockReturnValue(sessions);
  render(TuneSessions);

  const status = screen.getByLabelText('status');
  expect(status).toBeDefined();
});

test('should display sessions', async () => {
  const time = new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000).getTime() / 1000; // 6 days ago
  const sessions: InstructlabSession[] = [
    {
      name: 'session 1',
      modelId: 'model1',
      targetModel: 'model1-target',
      repository: '/repo1',
      status: 'fine-tuned',
      createdTime: time,
    },
    {
      name: 'session 2',
      modelId: 'model2',
      targetModel: 'model2-target',
      repository: '/repo2',
      status: 'generating-instructions',
      createdTime: time,
    },
  ];
  mocks.instructlabSessionsListMock.mockReturnValue(sessions);
  const catalog: ApplicationCatalog = {
    recipes: [],
    models: [],
    categories: [],
  };
  mocks.getCatalogMock.mockResolvedValue(catalog);
  render(TuneSessions);

  const table = screen.getByRole('table');
  expect(table).toBeDefined();

  // Should display 2 sessions (+ header)
  const rows = screen.queryAllByRole('row');
  expect(rows.length).toEqual(3);

  // First session is session 1
  const cellsSession1 = within(rows[1]).queryAllByRole('cell');
  expect(cellsSession1.length > 1).toBeTruthy();
  const name1 = await within(cellsSession1[1]).findByText('session 1');
  expect(name1).not.toBeNull();
  const duration1 = await within(cellsSession1[4]).findByText('6 days');
  expect(duration1).not.toBeNull();

  // Second session is session 2
  const cellsSession2 = within(rows[2]).queryAllByRole('cell');
  expect(cellsSession2.length > 1).toBeTruthy();
  const name2 = await within(cellsSession2[1]).findByText('session 2');
  expect(name2).not.toBeNull();

  // Open Running tab
  router.goto('running');

  await waitFor(async () => {
    const rows = screen.queryAllByRole('row');
    expect(rows.length).toEqual(2);

    // First session is session 2
    const cellsSession1 = within(rows[1]).queryAllByRole('cell');
    expect(cellsSession1.length > 1).toBeTruthy();
    const name1 = await within(cellsSession1[1]).findByText('session 2');
    expect(name1).not.toBeNull();
  });

  // Open All tab
  router.goto('..');

  await waitFor(async () => {
    const rows = screen.queryAllByRole('row');
    expect(rows.length).toEqual(3);
  });

  // Open Completed tab
  router.goto('completed');

  await waitFor(async () => {
    const rows = screen.queryAllByRole('row');
    expect(rows.length).toEqual(2);

    // First session is session 1
    const cellsSession1 = within(rows[1]).queryAllByRole('cell');
    expect(cellsSession1.length > 1).toBeTruthy();
    const name1 = await within(cellsSession1[1]).findByText('session 1');
    expect(name1).not.toBeNull();
  });
});
