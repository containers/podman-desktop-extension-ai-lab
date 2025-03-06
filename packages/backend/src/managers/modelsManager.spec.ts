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
import os from 'node:os';
import fs, { type Stats, type PathLike } from 'node:fs';
import path from 'node:path';
import { ModelsManager } from './modelsManager';
import { env, process as coreProcess } from '@podman-desktop/api';
import type { RunResult, TelemetryLogger, Webview, ContainerProviderConnection } from '@podman-desktop/api';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as utils from '../utils/utils';
import { TaskRegistry } from '../registries/TaskRegistry';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import * as sha from '../utils/sha';
import type { GGUFParseOutput } from '@huggingface/gguf';
import { gguf } from '@huggingface/gguf';
import type { PodmanConnection } from './podmanConnection';
import { VMType } from '@shared/src/models/IPodman';
import { getPodmanMachineName } from '../utils/podman';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import { Uploader } from '../utils/uploader';

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
    getPodmanCliMock: vi.fn(),
  };
});

vi.mock('../utils/uploader', () => ({
  Uploader: vi.fn(),
}));

vi.mock('@huggingface/gguf', () => ({
  gguf: vi.fn(),
}));

vi.mock('../utils/podman', () => ({
  getPodmanCli: mocks.getPodmanCliMock,
  getPodmanMachineName: vi.fn(),
}));

vi.mock('@podman-desktop/api', () => {
  return {
    Disposable: {
      create: vi.fn(),
    },
    env: {
      isWindows: false,
    },
    process: {
      exec: vi.fn(),
    },
    fs: {
      createFileSystemWatcher: (): unknown => ({
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
    get completed(): boolean {
      return mocks.getDownloaderCompleter();
    }
    onEvent = mocks.onEventDownloadMock;
    perform = mocks.performDownloadMock;
    getTarget = mocks.getTargetMock;
  },
}));

const podmanConnectionMock = {
  getContainerProviderConnections: vi.fn(),
} as unknown as PodmanConnection;

const cancellationTokenRegistryMock = {
  createCancellationTokenSource: vi.fn(),
} as unknown as CancellationTokenRegistry;

let taskRegistry: TaskRegistry;

const telemetryLogger = {
  logUsage: mocks.logUsageMock,
  logError: mocks.logErrorMock,
} as unknown as TelemetryLogger;

const configurationRegistryMock: ConfigurationRegistry = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

beforeEach(() => {
  vi.resetAllMocks();
  taskRegistry = new TaskRegistry({ postMessage: vi.fn().mockResolvedValue(undefined) } as unknown as Webview);

  vi.mocked(configurationRegistryMock.getExtensionConfiguration).mockReturnValue({
    modelUploadDisabled: false,
    modelsPath: '~/downloads',
    experimentalTuning: false,
    apiPort: 0,
    experimentalGPU: false,
    showGPUPromotion: false,
    appearance: 'dark',
  });

  mocks.isCompletionEventMock.mockReturnValue(true);
});

const dirent = [
  {
    isDirectory: (): boolean => true,
    path: '/home/user/appstudio-dir',
    name: 'model-id-1',
  },
  {
    isDirectory: (): boolean => true,
    path: '/home/user/appstudio-dir',
    name: 'model-id-2',
  },
  {
    isDirectory: (): boolean => false,
    path: '/home/user/appstudio-dir',
    name: 'other-file-should-be-ignored.txt',
  },
] as fs.Dirent[];

function mockFiles(now: Date): void {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockImplementation((path: PathLike) => {
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
    (path: string) => string[] | fs.Dirent[]
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
  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    modelsDir,
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
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
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
  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    modelsDir,
    {} as Webview,
    {
      getModels(): ModelInfo[] {
        return [];
      },
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
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
  const statSyncSpy = vi.spyOn(fs, 'statSync') as unknown as MockInstance<(path: PathLike) => Stats>;
  statSyncSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return { isDirectory: () => true } as Stats;
  });

  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    modelsDir,
    {
      postMessage: vi.fn(),
    } as unknown as Webview,
    {
      getModels(): ModelInfo[] {
        return [{ id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo];
      },
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
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
  const statSyncSpy = vi.spyOn(fs, 'statSync') as unknown as MockInstance<(path: PathLike) => Stats>;
  statSyncSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return { isDirectory: () => true } as Stats;
  });

  const readdirSyncMock = vi.spyOn(fs, 'readdirSync') as unknown as MockInstance<
    (path: string) => string[] | fs.Dirent[]
  >;
  readdirSyncMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return [base + '-model.tmp'];
    } else {
      return dirent;
    }
  });

  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    modelsDir,
    {
      postMessage: vi.fn(),
    } as unknown as Webview,
    {
      getModels(): ModelInfo[] {
        return [{ id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo];
      },
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
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
  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    modelsDir,
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
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
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

test('deleteModel deletes the model folder', async () => {
  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const now = new Date();
  mockFiles(now);
  const rmSpy = vi.spyOn(fs.promises, 'rm');
  rmSpy.mockResolvedValue();
  const postMessageMock = vi.fn();
  const manager = new ModelsManager(
    modelsDir,
    {
      postMessage: postMessageMock,
    } as unknown as Webview,
    {
      getModels: () => {
        return [
          {
            id: 'model-id-1',
            url: 'model-url',
          },
        ] as ModelInfo[];
      },
      onUpdate: vi.fn(),
    } as unknown as CatalogManager,
    telemetryLogger,
    taskRegistry,
    cancellationTokenRegistryMock,
    podmanConnectionMock,
    configurationRegistryMock,
  );
  manager.init();
  await manager.loadLocalModels();
  await manager.deleteModel('model-id-1');
  // check that the model's folder is removed from disk
  if (process.platform === 'win32') {
    expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', {
      recursive: true,
      force: true,
      maxRetries: 3,
    });
  } else {
    expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', {
      recursive: true,
      force: true,
      maxRetries: 3,
    });
  }
  expect(postMessageMock).toHaveBeenCalledTimes(4);
  // check that a new state is sent with the model removed
  expect(postMessageMock).toHaveBeenNthCalledWith(4, {
    id: 'new-models-state',
    body: [
      {
        id: 'model-id-1',
        url: 'model-url',
      },
    ],
  });
  expect(mocks.logUsageMock).toHaveBeenNthCalledWith(1, 'model.delete', { 'model.id': expect.any(String) });
});

describe('deleting models', () => {
  test('deleteModel fails to delete the model folder', async () => {
    let modelsDir: string;
    if (process.platform === 'win32') {
      modelsDir = 'C:\\home\\user\\aistudio\\models';
    } else {
      modelsDir = '/home/user/aistudio/models';
    }
    const now = new Date();
    mockFiles(now);
    const rmSpy = vi.spyOn(fs.promises, 'rm');
    rmSpy.mockRejectedValue(new Error('failed'));
    const postMessageMock = vi.fn();
    const manager = new ModelsManager(
      modelsDir,
      {
        postMessage: postMessageMock,
      } as unknown as Webview,
      {
        getModels: () => {
          return [
            {
              id: 'model-id-1',
              url: 'model-url',
            },
          ] as ModelInfo[];
        },
        onUpdate: vi.fn(),
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );
    manager.init();
    await manager.loadLocalModels();
    await manager.deleteModel('model-id-1');
    // check that the model's folder is removed from disk
    if (process.platform === 'win32') {
      expect(rmSpy).toBeCalledWith('C:\\home\\user\\aistudio\\models\\model-id-1', {
        recursive: true,
        force: true,
        maxRetries: 3,
      });
    } else {
      expect(rmSpy).toBeCalledWith('/home/user/aistudio/models/model-id-1', {
        recursive: true,
        force: true,
        maxRetries: 3,
      });
    }
    expect(postMessageMock).toHaveBeenCalledTimes(4);
    // check that a new state is sent with the model non removed
    expect(postMessageMock).toHaveBeenNthCalledWith(4, {
      id: 'new-models-state',
      body: [
        {
          id: 'model-id-1',
          url: 'model-url',
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

  test('delete local model should call catalogManager', async () => {
    vi.mocked(env).isWindows = false;
    const postMessageMock = vi.fn();
    const removeUserModelMock = vi.fn();
    const manager = new ModelsManager(
      'appdir',
      {
        postMessage: postMessageMock,
      } as unknown as Webview,
      {
        getModels: () => {
          return [
            {
              id: 'model-id-1',
              file: {
                file: 'model-id-1-model',
                size: 32000,
                path: path.resolve(dirent[0].path, dirent[0].name),
              },
            },
          ] as ModelInfo[];
        },
        removeUserModel: removeUserModelMock,
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );
    await manager.loadLocalModels();
    await manager.deleteModel('model-id-1');

    expect(removeUserModelMock).toBeCalledWith('model-id-1');
  });

  test('deleting on windows should check for all connections', async () => {
    vi.mocked(coreProcess.exec).mockResolvedValue({} as RunResult);
    mocks.getPodmanCliMock.mockReturnValue('dummyCli');
    vi.mocked(env).isWindows = true;
    const connections: ContainerProviderConnection[] = [
      {
        name: 'Machine 1',
        type: 'podman',
        vmType: VMType.HYPERV,
        endpoint: {
          socketPath: '',
        },
        status: () => 'started',
      },
      {
        name: 'Machine 2',
        type: 'podman',
        vmType: VMType.WSL,
        endpoint: {
          socketPath: '',
        },
        status: () => 'started',
      },
    ];
    vi.mocked(podmanConnectionMock.getContainerProviderConnections).mockReturnValue(connections);
    vi.mocked(getPodmanMachineName).mockReturnValue('machine-2');

    const rmSpy = vi.spyOn(fs.promises, 'rm');
    rmSpy.mockResolvedValue(undefined);

    const manager = new ModelsManager(
      '/home/user/aistudio',
      {
        postMessage: vi.fn().mockResolvedValue(undefined),
      } as unknown as Webview,
      {
        getModels: () => {
          return [
            {
              id: 'model-id-1',
              url: 'model-url',
              file: {
                file: 'dummyFile',
                path: 'dummyPath',
              },
            },
          ] as ModelInfo[];
        },
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    await manager.loadLocalModels();
    // delete the model
    await manager.deleteModel('model-id-1');

    expect(podmanConnectionMock.getContainerProviderConnections).toHaveBeenCalledOnce();

    expect(coreProcess.exec).toHaveBeenCalledWith('dummyCli', [
      'machine',
      'ssh',
      'machine-2',
      'rm',
      '-f',
      '/home/user/ai-lab/models/dummyFile',
    ]);
  });
});

describe('downloadModel', () => {
  test('download model if not already on disk', async () => {
    vi.mocked(cancellationTokenRegistryMock.createCancellationTokenSource).mockReturnValue(99);
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
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);
    const updateTaskMock = vi.spyOn(taskRegistry, 'updateTask');
    await manager.requestDownloadModel({
      id: 'id',
      url: 'url',
      name: 'name',
    } as ModelInfo);

    expect(cancellationTokenRegistryMock.createCancellationTokenSource).toHaveBeenCalled();
    expect(updateTaskMock).toHaveBeenLastCalledWith({
      id: expect.any(String),
      name: 'Downloading model name',
      labels: {
        'model-pulling': 'id',
      },
      state: 'loading',
      cancellationToken: 99,
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
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
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
  test('fail if model on disk has different sha of the expected value', async () => {
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
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );
    vi.spyOn(taskRegistry, 'updateTask');
    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(true);
    vi.spyOn(manager, 'getLocalModelPath').mockReturnValue('path');
    vi.spyOn(sha, 'hasValidSha').mockResolvedValue(false);
    await expect(() =>
      manager.requestDownloadModel({
        id: 'id',
        url: 'url',
        name: 'name',
        sha256: 'sha',
      } as ModelInfo),
    ).rejects.toThrowError(
      'Model name is already present on disk at path but its security hash (SHA-256) does not match the expected value. This may indicate the file has been altered or corrupted. Please delete it and try again.',
    );
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
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
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
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);

    mocks.onEventDownloadMock.mockImplementation(listener => {
      setTimeout(() => {
        listener({
          id: 'id',
          status: 'completed',
          duration: 1000,
        });
      }, 1000);
      return {
        dispose: vi.fn(),
      };
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

describe('getModelMetadata', () => {
  test('unknown model', async () => {
    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels: (): ModelInfo[] => [],
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    await expect(() => manager.getModelMetadata('unknown-model-id')).rejects.toThrowError(
      'model with id unknown-model-id does not exists.',
    );
  });

  test('remote model', async () => {
    const manager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels: (): ModelInfo[] => [
          {
            id: 'test-model-id',
            url: 'dummy-url',
            file: undefined,
          } as unknown as ModelInfo,
        ],
        onUpdate: vi.fn(),
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    manager.init();

    const fakeMetadata: Record<string, string> = {
      hello: 'world',
    };

    vi.mocked(gguf).mockResolvedValue({
      metadata: fakeMetadata,
    } as unknown as GGUFParseOutput & { parameterCount: number });

    const result = await manager.getModelMetadata('test-model-id');
    expect(result).toStrictEqual(fakeMetadata);

    expect(gguf).toHaveBeenCalledWith('dummy-url');
  });

  test('local model', async () => {
    const manager = new ModelsManager(
      'appdir',
      {
        postMessage: vi.fn(),
      } as unknown as Webview,
      {
        getModels: (): ModelInfo[] => [
          {
            id: 'test-model-id',
            url: 'dummy-url',
            file: {
              file: 'random',
              path: 'dummy-path',
            },
          } as unknown as ModelInfo,
        ],
        onUpdate: vi.fn(),
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    manager.init();

    const fakeMetadata: Record<string, string> = {
      hello: 'world',
    };

    vi.mocked(gguf).mockResolvedValue({
      metadata: fakeMetadata,
    } as unknown as GGUFParseOutput & { parameterCount: number });

    const result = await manager.getModelMetadata('test-model-id');
    expect(result).toStrictEqual(fakeMetadata);

    expect(gguf).toHaveBeenCalledWith(path.join('dummy-path', 'random'), {
      allowLocalFile: true,
    });
  });
});

const connectionMock: ContainerProviderConnection = {
  name: 'dummy-connection',
  type: 'podman',
  vmType: undefined,
} as unknown as ContainerProviderConnection;

const modelMock: ModelInfo = {
  id: 'test-model-id',
  url: 'dummy-url',
  file: {
    file: 'random',
    path: 'dummy-path',
  },
} as unknown as ModelInfo;

describe('uploadModelToPodmanMachine', () => {
  test('uploader should be used', async () => {
    const performMock = vi.fn().mockResolvedValue('uploader-result');
    vi.mocked(Uploader).mockReturnValue({
      onEvent: vi.fn(),
      perform: performMock,
    } as unknown as Uploader);

    const manager = new ModelsManager(
      'appdir',
      {
        postMessage: vi.fn(),
      } as unknown as Webview,
      {
        onUpdate: vi.fn(),
        getModels: () => [],
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    manager.init();
    const result = await manager.uploadModelToPodmanMachine(connectionMock, modelMock);
    expect(result).toBe('uploader-result');
    expect(performMock).toHaveBeenCalledWith(modelMock.id);
  });

  test('upload should be skipped when configuration disable it', async () => {
    vi.mocked(configurationRegistryMock.getExtensionConfiguration).mockReturnValue({
      // disable upload
      modelUploadDisabled: true,
      modelsPath: '~/downloads',
      experimentalTuning: false,
      apiPort: 0,
      experimentalGPU: false,
      showGPUPromotion: false,
      appearance: 'dark',
    });

    const manager = new ModelsManager(
      'appdir',
      {
        postMessage: vi.fn(),
      } as unknown as Webview,
      {
        onUpdate: vi.fn(),
        getModels: () => [],
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
    );

    manager.init();
    await manager.uploadModelToPodmanMachine(connectionMock, modelMock);
    expect(Uploader).not.toHaveBeenCalled();
  });
});
