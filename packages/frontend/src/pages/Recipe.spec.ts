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
import type { Catalog } from '@shared/src/models/ICatalog';
import * as catalogStore from '/@/stores/catalog';
import { readable, writable } from 'svelte/store';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn(),
    pullApplicationMock: vi.fn(),
    telemetryLogUsageMock: vi.fn(),
    getEnvironmentsStateMock: vi.fn(),
    getLocalRepositoriesMock: vi.fn(),
  };
});

vi.mock('../stores/localRepositories', () => ({
  localRepositories: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.getLocalRepositoriesMock());
      return () => {};
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
      getEnvironmentsState: mocks.getEnvironmentsStateMock,
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

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

const initialCatalog: Catalog = {
  categories: [],
  models: [
    {
      id: 'model1',
      name: 'Model 1',
      description: 'Readme for model 1',
      hw: 'CPU',
      registry: 'Hugging Face',
      license: '?',
      url: 'https://model1.example.com',
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: 'Readme for model 2',
      hw: 'CPU',
      registry: 'Civital',
      license: '?',
      url: '',
    },
  ],
  recipes: [
    {
      id: 'recipe 1',
      name: 'Recipe 1',
      readme: 'readme 1',
      categories: [],
      models: ['model1', 'model2'],
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

const updatedCatalog: Catalog = {
  categories: [],
  models: [
    {
      id: 'model1',
      name: 'Model 1',
      description: 'Readme for model 1',
      hw: 'CPU',
      registry: 'Hugging Face',
      license: '?',
      url: 'https://model1.example.com',
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: 'Readme for model 2',
      hw: 'CPU',
      registry: 'Civital',
      license: '?',
      url: '',
    },
  ],
  recipes: [
    {
      id: 'recipe 1',
      name: 'New Recipe Name',
      readme: 'readme 1',
      categories: [],
      models: ['model1', 'model2'],
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
});

test('should display recipe information', async () => {
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  screen.getByText('Recipe 1');
  screen.getByText('readme 1');
});

test('should display updated recipe information', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  const customCatalog = writable<Catalog>(initialCatalog);
  vi.mocked(catalogStore).catalog = customCatalog;
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  screen.getByText('Recipe 1');
  screen.getByText('readme 1');

  customCatalog.set(updatedCatalog);
  await new Promise(resolve => setTimeout(resolve, 10));
  screen.getByText('New Recipe Name');
});

test('should send telemetry data', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue([]);
  mocks.pullApplicationMock.mockResolvedValue(undefined);

  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(mocks.telemetryLogUsageMock).toHaveBeenNthCalledWith(1, 'recipe.open', {
    'recipe.id': 'recipe 1',
    'recipe.name': 'Recipe 1',
  });
});
