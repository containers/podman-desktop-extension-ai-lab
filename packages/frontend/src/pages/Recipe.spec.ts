import '@testing-library/jest-dom/vitest';
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import catalog from '../../../backend/src/ai-user-test.json';
import Recipe from './Recipe.svelte';
import userEvent from '@testing-library/user-event';

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

beforeEach(() => {
  vi.resetAllMocks();
});

test('should display recipe information', async () => {
  const recipe = catalog.recipes.find(r => r.id === 'recipe 1');
  expect(recipe).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  screen.getByText(recipe!.name);
  screen.getByText(recipe!.readme);
});

test('should display default model information', async () => {
  const recipe = catalog.recipes.find(r => r.id === 'recipe 1');
  expect(recipe).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  const modelInfo = screen.getByLabelText('model-selected');
  expect(modelInfo.textContent).equal('Model 1');
  const licenseBadge = screen.getByLabelText('license-model');
  expect(licenseBadge.textContent).equal('?');
  const defaultWarning = screen.getByLabelText('default-model-warning');
  expect(defaultWarning.textContent).contains('This is the default, recommended model for this recipe.');
});

test('should open/close application details panel when clicking on toggle button', async () => {
  const recipe = catalog.recipes.find(r => r.id === 'recipe 1');
  expect(recipe).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

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
  const recipe = catalog.recipes.find(r => r.id === 'recipe 1');
  expect(recipe).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  const btnRunApplication = screen.getByRole('button', { name: 'Run application' });
  await userEvent.click(btnRunApplication);

  expect(mocks.pullApplicationMock).toBeCalledWith('recipe 1');
});

test('should send telemetry data', async () => {
  const recipe = catalog.recipes.find(r => r.id === 'recipe 1');
  expect(recipe).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  mocks.getPullingStatusesMock.mockResolvedValue(new Map());
  render(Recipe, {
    recipeId: 'recipe 1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(mocks.telemetryLogUsageMock).toHaveBeenNthCalledWith(1, 'recipe.open', {
    'recipe.id': 'recipe 1',
    'recipe.name': 'Recipe 1',
  });
});
