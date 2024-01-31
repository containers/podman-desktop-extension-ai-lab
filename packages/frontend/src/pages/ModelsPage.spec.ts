import '@testing-library/jest-dom/vitest';
import { vi, test, expect } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Models from './Models.svelte';

const mocks = vi.hoisted(() => ({
  getLocalModelsMock: vi.fn().mockImplementation(() => Promise.resolve([])),
  localModelsSubscribeMock: vi.fn(),
  localModelsQueriesMock: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.localModelsSubscribeMock());
      return () => {};
    },
  },
}));

vi.mock('../stores/local-models', async () => {
  return {
    localModels: mocks.localModelsQueriesMock,
  };
});

test('no models provided should display no model yet', async () => {
  mocks.localModelsSubscribeMock.mockReturnValue([]);
  render(Models);

  const status = screen.getByRole('status', { value: { text: 'There is no model yet' } });
  expect(status).toBeDefined();
});
