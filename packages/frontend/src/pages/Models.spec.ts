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

import { vi, test, expect, describe } from 'vitest';
import { screen, render, waitFor, within } from '@testing-library/svelte';
import Models from './Models.svelte';
import { router } from 'tinro';
import userEvent from '@testing-library/user-event';
import type { InferenceServer } from '@shared/src/models/IInference';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn().mockResolvedValue(new Map()),
    modelsInfoSubscribeMock: vi.fn(),
    tasksSubscribeMock: vi.fn(),
    modelsInfoQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return (): void => {};
      },
    },
    tasksQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.tasksSubscribeMock());
        return (): void => {};
      },
    },
    getModelsInfoMock: vi.fn().mockResolvedValue([]),
    getTasks: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../stores/inferenceServers', () => ({
  inferenceServers: {
    subscribe: (f: (msg: InferenceServer[]) => void) => {
      f([]);
      return (): void => {};
    },
  },
}));

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      getModelsInfo: mocks.getModelsInfoMock,
      getPullingStatuses: mocks.getPullingStatusesMock,
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

  const status = screen.getByLabelText('status');
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

  const status = screen.getByLabelText('status');
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
  expect(cells.length > 2).toBeTruthy();

  const name = await within(cells[2]).findByText('dummy-name');
  expect(name).not.toBeNull();
});

test('should display downloaded model first', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([
    {
      id: 'dummy-local-id',
      name: 'dummy-local-name',
      memory: 1024,
      file: {
        path: 'random',
      },
    },
    {
      id: 'dummy-id',
      name: 'dummy-name',
      memory: 1024,
    },
  ]);
  mocks.tasksSubscribeMock.mockReturnValue([]);

  const { container } = render(Models);

  const table = within(container).getByRole('table');
  expect(table).toBeDefined();

  const rows = within(table).queryAllByRole('row');
  expect(rows.length).toBe(3);

  // First row should be the headers
  const headers = within(rows[0]).queryAllByRole('columnheader');
  expect(headers.length > 0).toBeTruthy();

  // second raw should be the model downloaded
  const deleteBtn = within(rows[1]).getByTitle('Delete Model');
  expect(deleteBtn).toBeDefined();

  // last raw should be the remote model
  const downloadBtn = within(rows[2]).getByTitle('Download Model');
  expect(downloadBtn).toBeDefined();
});

describe('downloaded models', () => {
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
      const status = screen.getByLabelText('status');
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
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        url: 'http://url',
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

  test('should display only downloaded models', async () => {
    mocks.modelsInfoSubscribeMock.mockReturnValue([
      {
        id: 'dummy-id-downloaded',
        name: 'dummy-downloaded-1',
        file: {
          file: 'dummy',
          path: 'dummy',
        },
        memory: 1024,
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        url: 'http://url',
      },
      {
        id: 'dummy-id-downloaded-2',
        name: 'dummy-downloaded-2',
        file: {
          file: 'dummy',
          path: 'dummy',
        },
        memory: 1024,
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        url: 'http://url',
      },
      {
        id: 'dummy-id-imported',
        name: 'dummy-imported',
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

    await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

    const rows = screen.getAllByRole('cell', { name: 'Model Name' });
    expect(rows.length).toBe(2);
    expect(await within(rows[0]).findByTitle('dummy-downloaded-1')).toBeDefined();
    expect(await within(rows[1]).findByTitle('dummy-downloaded-2')).toBeDefined();
  });
});

describe('imported models', () => {
  test('should display no model in imported tab', async () => {
    mocks.modelsInfoSubscribeMock.mockReturnValue([]);
    mocks.tasksSubscribeMock.mockReturnValue([]);

    render(Models);

    router.goto('imported');

    await waitFor(() => {
      const status = screen.getByLabelText('status');
      expect(status).toBeDefined();
    });
  });

  test('should display a model in imported tab', async () => {
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

    router.goto('imported');

    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table).toBeDefined();
    });
  });
});

describe('available models', () => {
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
      const status = screen.getByLabelText('status');
      expect(status).toBeDefined();
    });
  });
});

test('Import button should redirect to import page', async () => {
  const routerMock = vi.spyOn(router, 'goto');

  render(Models);

  const importButton = screen.getByRole('button', { name: 'Import Models' });
  await userEvent.click(importButton);

  expect(routerMock).toBeCalledWith('/models/import');
});
