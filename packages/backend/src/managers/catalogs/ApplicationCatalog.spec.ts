import { beforeEach, vi, expect, test } from 'vitest';
import applicationsCatalogTest from '../../tests/applications-catalog-test.json';
import { existsSync } from 'node:fs';
import { ApplicationCatalog } from './ApplicationCatalog';
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

vi.mock('../../assets/applications-catalog.json', () => {
  return {
    default: applicationsCatalogTest,
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

test('applications array should be empty when init not called', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ApplicationCatalog(webviewMock, '.');
  expect(catalog.getApplications().length).toBe(0);
});

test('applications array should not be empty when init called', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ApplicationCatalog(webviewMock, '.');
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getApplications().length).toBeGreaterThan(0);
  });
  expect(webviewMock.postMessage).toHaveBeenCalled();
});

test('applications should contain test data', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const catalog = new ApplicationCatalog(webviewMock, '.');
  catalog.init();
  await vi.waitFor(() => {
    expect(catalog.getApplications().length).toBeGreaterThan(0);
  });
  expect(catalog.getApplications().some(model => model.id === 'test-chatbot')).toBeTruthy();
});

