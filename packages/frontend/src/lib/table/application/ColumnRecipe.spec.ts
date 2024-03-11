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
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import * as catalogStore from '/@/stores/catalog';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import { readable } from 'svelte/store';
import type { ApplicationCell } from '../../../pages/applications';
import ColumnRecipe from './ColumnRecipe.svelte';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => {
  return {
    openURL: vi.fn(),
  };
});

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      openURL: mocks.openURL,
    },
  };
});

const initialCatalog: ApplicationCatalog = {
  categories: [],
  models: [],
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

beforeEach(() => {
  vi.resetAllMocks();
});

test('display recipe name', async () => {
  const obj = {
    recipeId: 'recipe 1',
  } as unknown as ApplicationCell;
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(ColumnRecipe, { object: obj });

  const text = screen.getByText('Recipe 1');
  expect(text).toBeInTheDocument();
});

test('display recipe port', async () => {
  const obj = {
    recipeId: 'recipe 1',
    appPorts: [3000],
  } as unknown as ApplicationCell;
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(ColumnRecipe, { object: obj });

  const text = screen.getByText('Recipe 1');
  expect(text).toBeInTheDocument();
  const ports = screen.getByText('PORT 3000');
  expect(ports).toBeInTheDocument();
});

test('display multiple recipe ports', async () => {
  const obj = {
    recipeId: 'recipe 1',
    appPorts: [3000, 5000],
  } as unknown as ApplicationCell;
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(ColumnRecipe, { object: obj });

  const text = screen.getByText('Recipe 1');
  expect(text).toBeInTheDocument();
  const ports = screen.getByText('PORTS 3000, 5000');
  expect(ports).toBeInTheDocument();
});

test('click on open port', async () => {
  const obj = {
    recipeId: 'recipe 1',
    appPorts: [3000, 5000],
  } as unknown as ApplicationCell;
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(ColumnRecipe, { object: obj });
  mocks.openURL.mockResolvedValue(undefined);
  const link = screen.getByRole('button', { name: 'open AI App on port 5000' });
  await userEvent.click(link);
  expect(mocks.openURL).toHaveBeenCalledWith('http://localhost:5000');
});
