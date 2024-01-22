import { vi, test, expect } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import catalog from '../../../backend/src/ai-user-test.json';
import Recipe from './Recipe.svelte';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
    getPullingStatusesMock: vi.fn(),
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
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
