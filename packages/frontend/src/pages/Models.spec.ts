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
import Models from './Models.svelte';
import { router } from 'tinro';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn().mockResolvedValue(new Map()),
    modelsInfoSubscribeMock: vi.fn(),
    tasksSubscribeMock: vi.fn(),
    modelsInfoQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return () => {};
      },
    },
    tasksQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.tasksSubscribeMock());
        return () => {};
      },
    },
    getModelsInfoMock: vi.fn().mockResolvedValue([]),
    getTasks: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      getModelsInfo: mocks.getModelsInfoMock,
      getPullingStatuses: mocks.getPullingStatusesMock,
    },
    rpcBrowser: {
      subscribe: () => {
        return {
          unsubscribe: () => {},
        };
      },
    },
  };
});

vi.mock('../stores/modelsInfo', async () => {
  return {
    modelsInfo: mocks.modelsInfoQueriesMock,
  };
});

vi.mock('../stores/tasks', async () => {
  return {
    tasks: mocks.tasksQueriesMock,
  };
});

test('should display There is no model yet', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  const status = screen.getByRole('status');
  expect(status).toBeDefined();
});

test('should display There is no model yet and have a task running', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  mocks.tasksSubscribeMock.mockReturnValue([
    {
      id: 'random',
      name: 'random',
      state: 'loading',
      labels: {
        'model-pulling': 'random-models-id',
      },
    },
  ]);
  render(Models);

  const status = screen.getByRole('status');
  expect(status).toBeDefined();

  await waitFor(() => {
    const title = screen.getByText('Downloading models');
    expect(title).toBeDefined();
  });
});

test('should not display any tasks running', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  mocks.tasksSubscribeMock.mockReturnValue([
    {
      id: 'random',
      name: 'random',
      state: 'loading',
    },
  ]);
  mocks.getPullingStatusesMock.mockResolvedValue([]);

  render(Models);

  const notification = screen.queryByText('Downloading models');
  expect(notification).toBeNull();
});

test('should display one model', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-id',
      name: 'dummy-name',
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  const table = screen.getByRole('table');
  expect(table).toBeDefined();

  const cells = screen.queryAllByRole('cell');
  expect(cells.length > 0).toBeTruthy();

  const name = within(cells[0]).findByText('dummy-name');
  expect(name).toBeDefined();
});

test('should display no model in downloaded tab', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-id',
      name: 'dummy-name',
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  router.goto('downloaded');

  await waitFor(() => {
    const status = screen.getByRole('status');
    expect(status).toBeDefined();
  });
});

test('should display a model in downloaded tab', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-id',
      name: 'dummy-name',
      file: {
        file: 'dummy',
        path: 'dummy',
      },
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  router.goto('downloaded');

  await waitFor(() => {
    const table = screen.getByRole('table');
    expect(table).toBeDefined();
  });
});

test('should display a model in available tab', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-id',
      name: 'dummy-name',
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  router.goto('available');

  await waitFor(() => {
    const table = screen.getByRole('table');
    expect(table).toBeDefined();
  });
});

test('should display no model in available tab', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-id',
      name: 'dummy-name',
      file: {
        file: 'dummy',
        path: 'dummy',
      },
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  render(Models);

  router.goto('available');

  await waitFor(() => {
    const status = screen.getByRole('status');
    expect(status).toBeDefined();
  });
});

test('Import button should redirect to import page', async () => {
  const routerMock = vi.spyOn(router, 'goto');

  render(Models);

  const importButton = screen.getByRole('button', { name: 'Import Models' });
  await userEvent.click(importButton);

  expect(routerMock).toBeCalledWith('/models/import');
});
