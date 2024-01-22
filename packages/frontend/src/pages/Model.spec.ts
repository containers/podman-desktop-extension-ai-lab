import { vi, test, expect } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Model from './Model.svelte';
import catalog from '../../../backend/src/ai-user-test.json';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
      saveRouterState: vi.fn(),
      getRouterState: vi.fn().mockResolvedValue({url: '/'}),
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

test('should display model information', async () => {
  const model = catalog.models.find(m => m.id === 'model1');
  expect(model).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  render(Model, {
    modelId: 'model1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  screen.getByText(model!.name);
  screen.getByText(model!.description);
});
