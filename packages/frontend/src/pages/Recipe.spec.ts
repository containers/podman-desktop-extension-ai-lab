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
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Recipe from './Recipe.svelte';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import * as catalogStore from '/@/stores/catalog';
import { readable, writable } from 'svelte/store';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn(),
    pullApplicationMock: vi.fn(),
    telemetryLogUsageMock: vi.fn(),
    getApplicationsStateMock: vi.fn(),
    getLocalRepositoriesMock: vi.fn(),
    getTasksMock: vi.fn(),
    getModelsInfo: vi.fn(),
  };
});

vi.mock('../stores/tasks', () => ({
  tasks: {
    subscribe: (f: (msg: unknown) => void) => {
      f(mocks.getTasksMock());
      return (): void => {};
    },
  },
}));

vi.mock('../stores/localRepositories', () => ({
  localRepositories: {
    subscribe: (f: (msg: unknown) => void) => {
      f(mocks.getLocalRepositoriesMock());
      return (): void => {};
    },
  },
}));

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
      getPullingStatuses: mocks.getPullingStatusesMock,
      pullApplication: mocks.pullApplicationMock,
      telemetryLogUsage: mocks.telemetryLogUsageMock,
      getApplicationsState: mocks.getApplicationsStateMock,
      getModelsInfo: mocks.getModelsInfo,
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

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

const initialCatalog: ApplicationCatalog = {
  categories: [],
  models: [
    {
      id: 'model1',
      name: 'Model 1',
      description: 'Readme for model 1',
      registry: 'Hugging Face',
      license: '?',
      url: 'https://model1.example.com',
      memory: 1000,
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: 'Readme for model 2',
      registry: 'Civital',
      license: '?',
      url: '',
      memory: 1000,
    },
  ],
  recipes: [
    {
      id: 'recipe 1',
      name: 'Recipe 1',
      readme: 'readme 1',
      categories: [],
      recommended: ['model1', 'model2'],
      description: 'description 1',
      repository: 'repo 1',
    },
    {
      id: 'recipe 2',
      name: 'Recipe 2',
      readme: 'readme 2',
      categories: [],
      description: 'description 2',
      repository: 'repo 2',
    },
  ],
};

const updatedCatalog: ApplicationCatalog = {
  categories: [],
  models: [
    {
      id: 'model1',
      name: 'Model 1',
      description: 'Readme for model 1',
      registry: 'Hugging Face',
      license: '?',
      url: 'https://model1.example.com',
      memory: 1000,
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: 'Readme for model 2',
      registry: 'Civital',
      license: '?',
      url: '',
      memory: 1000,
    },
  ],
  recipes: [
    {
      id: 'recipe 1',
      name: 'New Recipe Name',
      readme: 'readme 1',
      categories: [],
      recommended: ['model1', 'model2'],
      description: 'description 1',
      repository: 'repo 1',
    },
    {
      id: 'recipe 2',
      name: 'Recipe 2',
      readme: 'readme 2',
      categories: [],
      description: 'description 2',
      repository: 'repo 2',
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getLocalRepositoriesMock.mockReturnValue([]);
  mocks.getTasksMock.mockReturnValue([]);
  mocks.telemetryLogUsageMock.mockReturnValue(Promise.resolve());
});

test('should display recipe information', async () => {
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  mocks.getApplicationsStateMock.mockResolvedValue([]);
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  mocks.getModelsInfo.mockResolvedValue([]);
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  expect(screen.queryAllByText('Recipe 1').length).greaterThan(0);
  expect(screen.queryAllByText('readme 1').length).greaterThan(0);
});

test('should display updated recipe information', async () => {
  mocks.getApplicationsStateMock.mockResolvedValue([]);
  const customCatalog = writable<ApplicationCatalog>(initialCatalog);
  vi.mocked(catalogStore).catalog = customCatalog;
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  mocks.getModelsInfo.mockResolvedValue([]);
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  expect(screen.queryAllByText('Recipe 1').length).greaterThan(0);
  expect(screen.queryAllByText('readme 1').length).greaterThan(0);

  customCatalog.set(updatedCatalog);
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(screen.queryAllByText('New Recipe Name').length).greaterThan(0);
});

test('should send telemetry data', async () => {
  mocks.getApplicationsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  mocks.pullApplicationMock.mockResolvedValue(undefined);
  mocks.getModelsInfo.mockResolvedValue([]);
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(mocks.telemetryLogUsageMock).toHaveBeenNthCalledWith(1, 'recipe.open', {
    'recipe.id': 'recipe 1',
    'recipe.name': 'Recipe 1',
  });
});
