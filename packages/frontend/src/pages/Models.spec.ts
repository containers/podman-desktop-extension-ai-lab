import '@testing-library/jest-dom/vitest';
import { vi, test, expect } from 'vitest';
import { screen, fireEvent, render, waitFor } from '@testing-library/svelte';
import Models from '/@/pages/Models.svelte';

const mocks = vi.hoisted(() => {
  return {
    getModelsDirectoryMock: vi.fn(),
    openFileMock: vi.fn(),
    localModelsMock: {
      subscribe: (_f: (msg: any) => void) => {
        return () => {};
      },
    },
    modelsPullingSubscribeMock: vi.fn(),
    modelsPullingMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.modelsPullingSubscribeMock());
        return () => {};
      },
    },
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getModelsDirectory: mocks.getModelsDirectoryMock,
      openFile: mocks.openFileMock,
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
    localModels: mocks.localModelsMock,
  };
});

vi.mock('../stores/recipe', async () => {
  return {
    modelsPulling: mocks.modelsPullingMock,
  };
});

test('open models directory should call the api', async () => {
  mocks.getModelsDirectoryMock.mockResolvedValue('fake');
  mocks.modelsPullingSubscribeMock.mockReturnValue([]);
  render(Models);

  await waitFor(async () => {
    const open = screen.getByTitle('open-models-directory');
    expect(open).toBeDefined();

    await fireEvent.click(open);
  });

  await waitFor(() => {
    expect(mocks.openFileMock).toHaveBeenNthCalledWith(1, 'fake');
  });
});
