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
    localModelsQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return () => {};
      },
    },
    getModelsInfoMock: vi.fn().mockResolvedValue([]),
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

test('should display There is no model yet', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);

  render(Models);

  const status = screen.getByRole('status');
  expect(status).toBeDefined();
});

test('should display There is no model yet and have a task running', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  const map = new Map<string, RecipeStatus>();
  map.set('random', {
    recipeId: 'random-recipe-id',
    state: 'loading',
    tasks: [
      {
        id: 'random',
        name: 'random',
        state: 'loading',
        labels: {
          'model-pulling': 'random-models-id',
        },
      },
    ],
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
