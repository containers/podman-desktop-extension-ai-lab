/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { type MockInstance, beforeEach, describe, expect, test, vi } from 'vitest';
import os from 'os';
import fs, { type Stats, type PathLike } from 'node:fs';
import path from 'node:path';
import { ModelsManager } from './modelsManager';
import type { TelemetryLogger, Webview } from '@podman-desktop/api';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as utils from '../utils/utils';
import { TaskRegistry } from '../registries/TaskRegistry';

const mocks = vi.hoisted(() => {
  return {
    showErrorMessageMock: vi.fn(),
    logUsageMock: vi.fn(),
    logErrorMock: vi.fn(),
    performDownloadMock: vi.fn(),
    onEventDownloadMock: vi.fn(),
    getTargetMock: vi.fn(),
    getDownloaderCompleter: vi.fn(),
    isCompletionEventMock: vi.fn(),
  };
});

vi.mock('@podman-desktop/api', () => {
  return {
    fs: {
      createFileSystemWatcher: () => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
    window: {
      showErrorMessage: mocks.showErrorMessageMock,
    },
  };
});

vi.mock('../utils/downloader', () => ({
  isCompletionEvent: mocks.isCompletionEventMock,
  Downloader: class {
    get completed() {
      return mocks.getDownloaderCompleter();
    }
    onEvent = mocks.onEventDownloadMock;
    perform = mocks.performDownloadMock;
    getTarget = mocks.getTargetMock;
  },
}));

let taskRegistry: TaskRegistry;

const telemetryLogger = {
  logUsage: mocks.logUsageMock,
  logError: mocks.logErrorMock,
} as unknown as TelemetryLogger;

beforeEach(() => {
  vi.resetAllMocks();
  taskRegistry = new TaskRegistry({ postMessage: vi.fn().mockResolvedValue(undefined) } as unknown as Webview);

  mocks.isCompletionEventMock.mockReturnValue(true);
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

test('getModelsInfo should get models in local directory', async () => {
  const now = new Date();
  mockFiles(now);
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(
    appdir,
    {
      postMessage: vi.fn(),
    } as unknown as Webview,
    {
      getModels(): ModelInfo[] {
        return [
          { id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo,
          { id: 'model-id-2', name: 'model-id-2-model' } as ModelInfo,
        ];
      },
    } as CatalogManager,
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  expect(manager.getModelsInfo()).toEqual([
    {
      id: 'model-id-1',
      name: 'model-id-1-model',
      file: {
        size: 32000,
        creation: now,
        path: path.resolve(dirent[0].path, dirent[0].name),
        file: 'model-id-1-model',
      },
    },
    {
      id: 'model-id-2',
      name: 'model-id-2-model',
      file: {
        size: 32000,
        creation: now,
        path: path.resolve(dirent[1].path, dirent[1].name),
        file: 'model-id-2-model',
      },
    },
  ]);
});

test('getModelsInfo should return an empty array if the models folder does not exist', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockReturnValue(false);
  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(
    appdir,
    {} as Webview,
    {
      getModels(): ModelInfo[] {
        return [];
      },
    } as CatalogManager,
    telemetryLogger,
    taskRegistry,
  );
  manager.getLocalModelsFromDisk();
  expect(manager.getModelsInfo()).toEqual([]);
  if (process.platform === 'win32') {
    expect(existsSyncSpy).toHaveBeenCalledWith('C:\\home\\user\\aistudio\\models');
  } else {
    expect(existsSyncSpy).toHaveBeenCalledWith('/home/user/aistudio/models');
  }
});

test('getLocalModelsFromDisk should return undefined Date and size when stat fail', async () => {
  const now = new Date();
  mockFiles(now);
  const statSyncSpy = vi.spyOn(fs, 'statSync');
  statSyncSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return { isDirectory: () => true } as Stats;
  });

  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(
    appdir,
    {
      postMessage: vi.fn(),
    } as unknown as Webview,
    {
      getModels(): ModelInfo[] {
        return [{ id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo];
      },
    } as CatalogManager,
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  expect(manager.getModelsInfo()).toEqual([
    {
      id: 'model-id-1',
      name: 'model-id-1-model',
      file: {
        size: undefined,
        creation: undefined,
        path: path.resolve(dirent[0].path, dirent[0].name),
        file: 'model-id-1-model',
      },
    },
  ]);
});

test('getLocalModelsFromDisk should skip folders containing tmp files', async () => {
  const now = new Date();
  mockFiles(now);
  const statSyncSpy = vi.spyOn(fs, 'statSync');
  statSyncSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return { isDirectory: () => true } as Stats;
  });

  const readdirSyncMock = vi.spyOn(fs, 'readdirSync') as unknown as MockInstance<
    [path: string],
    string[] | fs.Dirent[]
  >;
  readdirSyncMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return [base + '-model.tmp'];
    } else {
      return dirent;
    }
  });

  let appdir: string;
  if (process.platform === 'win32') {
    appdir = 'C:\\home\\user\\aistudio';
  } else {
    appdir = '/home/user/aistudio';
  }
  const manager = new ModelsManager(
    appdir,
    {
      postMessage: vi.fn(),
    } as unknown as Webview,
    {
      getModels(): ModelInfo[] {
        return [{ id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo];
      },
    } as CatalogManager,
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  expect(manager.getModelsInfo()).toEqual([
    {
      id: 'model-id-1',
      name: 'model-id-1-model',
    },
  ]);
});

test('loadLocalModels should post a message with the message on disk and on catalog', async () => {
  const now = new Date();
  mockFiles(now);

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
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  expect(postMessageMock).toHaveBeenNthCalledWith(1, {
    id: 'new-models-state',
    body: [
      {
        file: {
          creation: now,
          file: 'model-id-1-model',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name),
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
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  await manager.deleteLocalModel('model-id-1');
  // check that the model's folder is removed from disk
  if (process.platform === 'win32') {
    expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', { recursive: true });
  } else {
    expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', { recursive: true });
  }
  expect(postMessageMock).toHaveBeenCalledTimes(3);
  // check that a new state is sent with the model removed
  expect(postMessageMock).toHaveBeenNthCalledWith(3, {
    id: 'new-models-state',
    body: [
      {
        id: 'model-id-1',
      },
    ],
  });
  expect(mocks.logUsageMock).toHaveBeenNthCalledWith(1, 'model.delete', { 'model.id': 'model-id-1' });
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
    telemetryLogger,
    taskRegistry,
  );
  await manager.loadLocalModels();
  await manager.deleteLocalModel('model-id-1');
  // check that the model's folder is removed from disk
  if (process.platform === 'win32') {
    expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', { recursive: true });
  } else {
    expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', { recursive: true });
  }
  expect(postMessageMock).toHaveBeenCalledTimes(3);
  // check that a new state is sent with the model non removed
  expect(postMessageMock).toHaveBeenNthCalledWith(3, {
    id: 'new-models-state',
    body: [
      {
        id: 'model-id-1',
        file: {
          creation: now,
          file: 'model-id-1-model',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name),
        },
      },
    ],
  });
  expect(mocks.showErrorMessageMock).toHaveBeenCalledOnce();
  expect(mocks.logErrorMock).toHaveBeenCalled();
});

describe('downloadModel', () => {
  test('download model if not already on disk', async () => {
    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels(): ModelInfo[] {
          return [];
        },
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
    );

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);
    const updateTaskMock = vi.spyOn(taskRegistry, 'updateTask');
    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);
    expect(updateTaskMock).toHaveBeenLastCalledWith({
      id: expect.any(String),
      name: 'Downloading model name',
      labels: {
        'model-pulling': 'id',
      },
      state: 'loading',
    });
  });
  test('retrieve model path if already on disk', async () => {
    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels(): ModelInfo[] {
          return [];
        },
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
    );
    const updateTaskMock = vi.spyOn(taskRegistry, 'updateTask');
    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(true);
    const getLocalModelPathMock = vi.spyOn(manager, 'getLocalModelPath').mockReturnValue('');
    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);
    expect(getLocalModelPathMock).toBeCalledWith('id');
    expect(updateTaskMock).toHaveBeenLastCalledWith({
      id: expect.any(String),
      name: 'Model name already present on disk',
      labels: {
        'model-pulling': 'id',
      },
      state: 'success',
    });
  });
  test('multiple download request same model - second call after first completed', async () => {
    mocks.getDownloaderCompleter.mockReturnValue(true);

    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels(): ModelInfo[] {
          return [];
        },
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
    );

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);

    // Only called once
    expect(mocks.performDownloadMock).toHaveBeenCalledTimes(1);
    expect(mocks.onEventDownloadMock).toHaveBeenCalledTimes(1);
  });

  test('multiple download request same model - second call before first completed', async () => {
    mocks.getDownloaderCompleter.mockReturnValue(false);

    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels(): ModelInfo[] {
          return [];
        },
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
    );

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);

    mocks.onEventDownloadMock.mockImplementation(listener => {
      listener({
        id: 'id',
        status: 'completed',
        duration: 1000,
      });
    });

    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);

    // Only called once
    expect(mocks.performDownloadMock).toHaveBeenCalledTimes(1);
    expect(mocks.onEventDownloadMock).toHaveBeenCalledTimes(2);
  });
});
