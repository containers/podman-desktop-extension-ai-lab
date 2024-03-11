import { beforeEach, expect, test, vi } from 'vitest';
import modelsCatalogTest from '../../tests/models-catalog-test.json';
import { existsSync, promises } from 'node:fs';
import { BaseCatalog } from './BaseCatalog';
import { EventEmitter, type Webview } from '@podman-desktop/api';
import { MESSAGES } from '@shared/Messages';

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

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
    },
  };
});

const webviewMock = {
  postMessage: vi.fn(),
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
  const catalog = new BaseCatalog(webviewMock, MESSAGES.UPDATE_MODEL_CATALOG, '.', []);
  expect(catalog.getAll().length).toBe(0);
});

test('models array should not be empty when init called', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new BaseCatalog(webviewMock, MESSAGES.UPDATE_MODEL_CATALOG, '.', [{
    id: 'dummyId',
  }]);
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getAll().length).toBeGreaterThan(0);
  });
  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: MESSAGES.UPDATE_MODEL_CATALOG,
    body: [{id: 'dummyId'}],
  });
});

test('models should contain test data', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(modelsCatalogTest));
  const catalog = new BaseCatalog(webviewMock, MESSAGES.UPDATE_MODEL_CATALOG, '.', []);
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getAll().length).toBeGreaterThan(0);
  });
  expect(catalog.getAll().some(model => model.id === 'test-llama-2-7b-chat.Q5_K_S')).toBeTruthy();
});
