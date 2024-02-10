import '@testing-library/jest-dom/vitest';
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Recipe from './Recipe.svelte';
import userEvent from '@testing-library/user-event';
import type { Catalog } from '@shared/src/models/ICatalog';
const { mockCatalogStore } = await vi.hoisted(() => import('/@/stores/mocks/catalog'));

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn(),
    pullApplicationMock: vi.fn(),
    telemetryLogUsageMock: vi.fn(),
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
      getPullingStatuses: mocks.getPullingStatusesMock,
      pullApplication: mocks.pullApplicationMock,
      telemetryLogUsage: mocks.telemetryLogUsageMock,
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
    catalog: mockCatalogStore,
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

const updatedCatalog: Catalog = {
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
});

test('should display recipe information', async () => {
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  screen.getByText('Recipe 1');
  screen.getByText('readme 1');
});

test('should display updated recipe information', async () => {
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  screen.getByText('Recipe 1');
  screen.getByText('readme 1');

  mockCatalogStore.mockSetSubscribeValue(updatedCatalog);
  await new Promise(resolve => setTimeout(resolve, 10));
  screen.getByText('New Recipe Name');
});

test('should display default model information', async () => {
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  const modelInfo = screen.getByLabelText('model-selected');
  expect(modelInfo.textContent).equal('Model 1');
  const licenseBadge = screen.getByLabelText('license-model');
  expect(licenseBadge.textContent).equal('?');
  const defaultWarning = screen.getByLabelText('default-model-warning');
  expect(defaultWarning.textContent).contains('This is the default, recommended model for this recipe.');
});

test('should open/close application details panel when clicking on toggle button', async () => {
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
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
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.pullApplicationMock.mockResolvedValue(undefined);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });

  const btnRunApplication = screen.getByRole('button', { name: 'Run application' });
  await userEvent.click(btnRunApplication);

  expect(mocks.pullApplicationMock).toBeCalledWith('recipe 1');
});

test('should send telemetry data', async () => {
  mockCatalogStore.mockSetSubscribeValue(initialCatalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
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
