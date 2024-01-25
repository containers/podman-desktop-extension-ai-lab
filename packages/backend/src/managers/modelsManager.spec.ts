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

const dirent = [
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

function mockFiles(now: Date) {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockImplementation((path: string) => {
    if (process.platform === 'win32') {
      expect(path).toBe('C:\\home\\user\\aistudio\\models');
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
      return dirent;
    }
  });
}

test('getLocalModelsFromDisk should get models in local directory', () => {
  const now = new Date();
  mockFiles(now);
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(appdir, {} as Webview, {} as CatalogManager);
  manager.getLocalModelsFromDisk();
  expect(manager.getLocalModels()).toEqual([
    {
      id: 'model-id-1',
      file: 'model-id-1-model',
      size: 32000,
      creation: now,
      path: path.resolve(dirent[0].path, dirent[0].name, 'model-id-1-model'),
    },
    {
      id: 'model-id-2',
      file: 'model-id-2-model',
      size: 32000,
      creation: now,
      path: path.resolve(dirent[1].path, dirent[1].name, 'model-id-2-model'),
    },
  ]);
});

test('getLocalModelsFromDisk should return an empty array if the models folder does not exist', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockReturnValue(false);
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(appdir, {} as Webview, {} as CatalogManager);
  manager.getLocalModelsFromDisk();
  expect(manager.getLocalModels()).toEqual([]);
  if (process.platform === 'win32') {
    expect(existsSyncSpy).toHaveBeenCalledWith('C:\\home\\user\\aistudio\\models');
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
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(
    appdir,
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
          path: path.resolve(dirent[0].path, dirent[0].name, 'model-id-1-model'),
        },
        id: 'model-id-1',
      },
    ],
  });
});

test('deleteLocalModel deletes the model folder', async () => {
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const now = new Date();
  mockFiles(now);
  const rmSpy = vi.spyOn(fs.promises, 'rm');
  rmSpy.mockResolvedValue();
  const postMessageMock = vi.fn();
  const manager = new ModelsManager(
    appdir,
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
  manager.getLocalModelsFromDisk();
  await manager.deleteLocalModel('model-id-1');
  // check that the model's folder is removed from disk
  if (process.platform === 'win32') {
    expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', { recursive: true });
  } else {
    expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', { recursive: true });
  }
  expect(postMessageMock).toHaveBeenCalledTimes(2);
  // check that a state is sent with the model being deleted
  expect(postMessageMock).toHaveBeenCalledWith({
    id: 'new-local-models-state',
    body: [
      {
        file: {
          creation: now,
          file: 'model-id-1-model',
          id: 'model-id-1',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name, 'model-id-1-model'),
        },
        id: 'model-id-1',
        state: 'deleting',
      },
    ],
  });
  // check that a new state is sent with the model removed
  expect(postMessageMock).toHaveBeenCalledWith({
    id: 'new-local-models-state',
    body: [],
  });
});

test('deleteLocalModel fails to delete the model folder', async () => {
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const now = new Date();
  mockFiles(now);
  const rmSpy = vi.spyOn(fs.promises, 'rm');
  rmSpy.mockRejectedValue(new Error('failed'));
  const postMessageMock = vi.fn();
  const manager = new ModelsManager(
    appdir,
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
  manager.getLocalModelsFromDisk();
  await manager.deleteLocalModel('model-id-1');
  // check that the model's folder is removed from disk
  if (process.platform === 'win32') {
    expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', { recursive: true });
  } else {
    expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', { recursive: true });
  }
  expect(postMessageMock).toHaveBeenCalledTimes(2);
  // check that a state is sent with the model being deleted
  expect(postMessageMock).toHaveBeenCalledWith({
    id: 'new-local-models-state',
    body: [
      {
        file: {
          creation: now,
          file: 'model-id-1-model',
          id: 'model-id-1',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name, 'model-id-1-model'),
        },
        id: 'model-id-1',
        state: 'deleting',
      },
    ],
  });
  // check that a new state is sent with the model non removed
  expect(postMessageMock).toHaveBeenCalledWith({
    id: 'new-local-models-state',
    body: [
      {
        file: {
          creation: now,
          file: 'model-id-1-model',
          id: 'model-id-1',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name, 'model-id-1-model'),
        },
        id: 'model-id-1',
      },
    ],
  });
});
