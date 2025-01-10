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
import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import * as catalogStore from '/@/stores/catalog';
import { readable } from 'svelte/store';
import Recipes from '/@/pages/Recipes.svelte';
import { studioClient } from '../utils/client';

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

vi.mock('../utils/client', async () => ({
  studioClient: {
    filterRecipes: vi.fn(),
  },
}));

vi.mock('../stores/localRepositories', () => ({
  localRepositories: {
    subscribe: (f: (msg: unknown) => void) => {
      f([]);
      return (): void => {};
    },
  },
}));

const recipes = [
  {
    id: 'recipe1',
    name: 'Recipe 1',
    recommended: ['model1'],
    categories: [],
    description: 'Recipe 1',
    readme: '',
    repository: 'https://recipe-1',
  },
  {
    id: 'recipe2',
    name: 'Recipe 2',
    recommended: ['model2'],
    categories: ['dummy-category'],
    description: 'Recipe 2',
    readme: '',
    repository: 'https://recipe-2',
  },
];

const catalog: ApplicationCatalog = {
  recipes: recipes,
  models: [],
  categories: [
    {
      id: 'dummy-category',
      name: 'Dummy category',
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(catalogStore).catalog = readable(catalog);
  vi.mocked(studioClient).filterRecipes.mockResolvedValue({
    result: recipes,
    filters: {},
    choices: {},
  });
});

test('recipe without category should be visible', async () => {
  render(Recipes);

  await vi.waitFor(() => {
    const text = screen.getAllByText('Recipe 1');
    expect(text.length).toBeGreaterThan(0);
  });
});

test('recipe with category should be visible', async () => {
  render(Recipes);

  await vi.waitFor(() => {
    const text = screen.getAllByText('Recipe 2');
    expect(text.length).toBeGreaterThan(0);
  });
});
