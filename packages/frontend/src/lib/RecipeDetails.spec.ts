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
import userEvent from '@testing-library/user-event';
import type { Catalog } from '@shared/src/models/ICatalog';
import * as catalogStore from '/@/stores/catalog';
import { readable } from 'svelte/store';
import RecipeDetails from './RecipeDetails.svelte';
import { router } from 'tinro';

const mocks = vi.hoisted(() => {
  return {
    getPullingStatusesMock: vi.fn(),
    pullApplicationMock: vi.fn(),
    getEnvironmentsStateMock: vi.fn(),
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getPullingStatuses: mocks.getPullingStatusesMock,
      pullApplication: mocks.pullApplicationMock,
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
      popularity: 3,
      license: '?',
      url: 'https://model1.example.com',
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: 'Readme for model 2',
      hw: 'CPU',
      registry: 'Civital',
      popularity: 3,
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

beforeEach(() => {
  vi.resetAllMocks();
});

test('should open/close application details panel when clicking on toggle button', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model1',
  });

  const panelOpenDetails = screen.getByLabelText('toggle application details');
  expect(panelOpenDetails).toHaveClass('hidden');
  const panelAppDetails = screen.getByLabelText('application details panel');
  expect(panelAppDetails).toHaveClass('block');

  const btnShowPanel = screen.getByRole('button', { name: 'show application details' });
  const btnHidePanel = screen.getByRole('button', { name: 'hide application details' });

  await userEvent.click(btnHidePanel);

  expect(panelAppDetails).toHaveClass('hidden');
  expect(panelOpenDetails).toHaveClass('block');

  await userEvent.click(btnShowPanel);

  expect(panelAppDetails).toHaveClass('block');
  expect(panelOpenDetails).toHaveClass('hidden');
});

test('should call runApplication execution when run application button is clicked', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.pullApplicationMock.mockResolvedValue(undefined);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model1',
  });

  const btnRunApplication = screen.getByLabelText('Start Environment');
  await userEvent.click(btnRunApplication);

  expect(mocks.pullApplicationMock).toBeCalledWith('recipe 1', 'model1');
});

test('swap model button should move user to models tab', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  const gotoMock = vi.spyOn(router, 'goto');
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model1',
  });

  const btnSwap = screen.getByRole('button', { name: 'Go to Model' });
  await userEvent.click(btnSwap);

  expect(gotoMock).toBeCalledWith('/recipe/recipe 1/models');
});

test('swap model panel should be hidden on models tab', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model1',
  });

  // swap model panel is visible
  const swapModelPanel = screen.getByLabelText('swap model panel');
  expect(!swapModelPanel.classList.contains('hidden'));

  // click the swap panel to switch to the model tab
  const btnSwap = screen.getByRole('button', { name: 'Go to Model' });
  await userEvent.click(btnSwap);

  await new Promise(resolve => setTimeout(resolve, 200));
  // the swap model panel should be hidden
  const swapModelPanel2 = screen.getByLabelText('swap model panel');
  expect(swapModelPanel2.classList.contains('hidden'));
});

test('should display default model information when model is the recommended', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model1',
  });

  const modelInfo = screen.getByLabelText('model-selected');
  expect(modelInfo.textContent).equal('Model 1');
  const licenseBadge = screen.getByLabelText('license-model');
  expect(licenseBadge.textContent).equal('?');
  const defaultWarning = screen.getByLabelText('model-warning');
  expect(defaultWarning.textContent).contains('This is the default, recommended model for this recipe.');
});

test('should display non-default model information when model is not the recommended one', async () => {
  mocks.getEnvironmentsStateMock.mockResolvedValue([]);
  vi.mocked(catalogStore).catalog = readable<Catalog>(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(RecipeDetails, {
    recipeId: 'recipe 1',
    modelId: 'model2',
  });

  const modelInfo = screen.getByLabelText('model-selected');
  expect(modelInfo.textContent).equal('Model 2');
  const defaultWarning = screen.getByLabelText('model-warning');
  expect(defaultWarning.textContent).contains('The default model for this recipe is');
});
