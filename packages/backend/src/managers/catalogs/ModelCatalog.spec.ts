import { beforeEach, vi, expect, test } from 'vitest';
import modelsCatalogTest from '../../tests/models-catalog-test.json';
import { existsSync } from 'node:fs';
import { ModelCatalog } from './ModelCatalog';
import { EventEmitter, type Webview } from '@podman-desktop/api';

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    fs: {
      createFileSystemWatcher: () => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
  };
});

vi.mock('../../assets/models-catalog.json', () => {
  return {
    default: modelsCatalogTest,
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
    },
  };
});

const webviewMock = {
  postMessage:  vi.fn(),
} as unknown as Webview;

beforeEach(async () => {
  vi.resetAllMocks();

  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);

  // Mock EventEmitter
  const listeners: ((value: unknown) => void)[] = [];
  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);
});

test('models array should be empty when init not called', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ModelCatalog(webviewMock, '.');
  expect(catalog.getModels().length).toBe(0);
});

test('models array should not be empty when init called', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ModelCatalog(webviewMock, '.');
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getModels().length).toBeGreaterThan(0);
  });
  expect(webviewMock.postMessage).toHaveBeenCalled();
});

test('models should contain test data', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ModelCatalog(webviewMock, '.');
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getModels().length).toBeGreaterThan(0);
  });
  expect(catalog.getModels().some(model => model.id === 'test-llama-2-7b-chat.Q5_K_S')).toBeTruthy();
});

