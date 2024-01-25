import { type MockInstance, beforeEach, expect, test, vi } from 'vitest';
import os from 'os';
import fs from 'node:fs';
import path from 'node:path';
import { ModelsManager } from './modelsManager';
import type { Webview } from '@podman-desktop/api';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

beforeEach(() => {
  vi.resetAllMocks();
});

function mockFiles(now: Date) {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockImplementation((path: string) => {
    if (process.platform === 'win32') {
      expect(path).toBe('\\home\\user\\aistudio\\models');
    } else {
      expect(path).toBe('/home/user/aistudio/models');
    }
    return true;
  });
  const statSyncSpy = vi.spyOn(fs, 'statSync');
  const info = new fs.Stats();
  info.size = 32000;
  info.mtime = now;
  statSyncSpy.mockReturnValue(info);
  const readdirSyncMock = vi.spyOn(fs, 'readdirSync') as unknown as MockInstance<
    [path: string],
    string[] | fs.Dirent[]
  >;
  readdirSyncMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return [base + '-model'];
    } else {
      return [
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-1',
        },
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-2',
        },
        {
          isDirectory: () => false,
          path: '/home/user/appstudio-dir',
          name: 'other-file-should-be-ignored.txt',
        },
      ] as fs.Dirent[];
    }
  });
}

test('getLocalModelsFromDisk should get models in local directory', () => {
  const now = new Date();
  mockFiles(now);
  const manager = new ModelsManager('/home/user/aistudio', {} as Webview, {} as CatalogManager);
  manager.getLocalModelsFromDisk();
  expect(manager.getLocalModels()).toEqual([
    {
      id: 'model-id-1',
      file: 'model-id-1-model',
      size: 32000,
      creation: now,
    },
    {
      id: 'model-id-2',
      file: 'model-id-2-model',
      size: 32000,
      creation: now,
    },
  ]);
});

test('getLocalModelsFromDisk should return an empty array if the models folder does not exist', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockReturnValue(false);
  const manager = new ModelsManager('/home/user/aistudio', {} as Webview, {} as CatalogManager);
  manager.getLocalModelsFromDisk();
  expect(manager.getLocalModels()).toEqual([]);
  if (process.platform === 'win32') {
    expect(existsSyncSpy).toHaveBeenCalledWith('\\home\\user\\aistudio\\models');
  } else {
    expect(existsSyncSpy).toHaveBeenCalledWith('/home/user/aistudio/models');
  }
});

test('loadLocalModels should post a message with the message on disk and on catalog', async () => {
  const now = new Date();
  mockFiles(now);

  vi.mock('@podman-desktop/api', () => {
    return {
      fs: {
        createFileSystemWatcher: () => ({
          onDidCreate: vi.fn(),
          onDidDelete: vi.fn(),
          onDidChange: vi.fn(),
        }),
      },
    };
  });
  const postMessageMock = vi.fn();
  const manager = new ModelsManager(
    '/home/user/aistudio',
    {
      postMessage: postMessageMock,
    } as unknown as Webview,
    {
      getModels: () => {
        return [
          {
            id: 'model-id-1',
          },
        ] as ModelInfo[];
      },
    } as CatalogManager,
  );
  await manager.loadLocalModels();
  expect(postMessageMock).toHaveBeenNthCalledWith(1, {
    id: 'new-local-models-state',
    body: [
      {
        file: {
          creation: now,
          file: 'model-id-1-model',
          id: 'model-id-1',
          size: 32000,
        },
        id: 'model-id-1',
      },
    ],
  });
});
