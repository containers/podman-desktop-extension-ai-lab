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
import { render, screen } from '@testing-library/svelte';
import ColumnName from './ColumnName.svelte';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import * as catalogStore from '/@/stores/catalog';
import type { Catalog } from '@shared/src/models/ICatalog';
import { readable } from 'svelte/store';

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

const initialCatalog: Catalog = {
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

test('display name', async () => {
  const obj = {
    recipeId: 'recipe 1',
  } as unknown as EnvironmentState;
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  render(ColumnName, { object: obj });

  const text = screen.getByText('Recipe 1');
  expect(text).toBeInTheDocument();
});
