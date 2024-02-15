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
import { screen, render, waitFor } from '@testing-library/svelte';
import Models from './Models.svelte';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn().mockResolvedValue(new Map()),
    getLocalModelsMock: vi.fn().mockResolvedValue([]),
    modelsInfoSubscribeMock: vi.fn(),
    tasksSubscribeMock: vi.fn(),
    localModelsQueriesMock: {
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

vi.mock('../stores/local-models', async () => {
  return {
    localModels: mocks.localModelsQueriesMock,
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
  const map = new Map<string, RecipeStatus>();
  map.set('random', {
    recipeId: 'random-recipe-id',
    tasks: [],
  });
  mocks.getPullingStatusesMock.mockResolvedValue(map);

  render(Models);

  const status = screen.getByRole('status');
  expect(status).toBeDefined();

  await waitFor(() => {
    const title = screen.getByText('Downloading models');
    expect(title).toBeDefined();
  });
});
