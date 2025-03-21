/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import type { RunResult, TelemetryLogger, ContainerProviderConnection } from '@podman-desktop/api';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/models/IModelInfo';
import * as utils from '../utils/utils';
import { TaskRegistry } from '../registries/TaskRegistry';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import * as sha from '../utils/sha';
import type { GGUFParseOutput } from '@huggingface/gguf';
import { gguf } from '@huggingface/gguf';
import type { PodmanConnection } from './podmanConnection';
import { VMType } from '@shared/models/IPodman';
import { getPodmanMachineName } from '../utils/podman';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import { Uploader } from '../utils/uploader';
import { ModelHandlerRegistry } from '../registries/ModelHandlerRegistry';
import { URLModelHandler } from '../models/URLModelHandler';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';

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
    EventEmitter: vi.fn(),
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

let modelHandlerRegistry: ModelHandlerRegistry;

const rpcExtensionMock = {
  fire: vi.fn(),
} as unknown as RpcExtension;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rpcExtensionMock.fire).mockResolvedValue(true);
  taskRegistry = new TaskRegistry(rpcExtensionMock);
  modelHandlerRegistry = new ModelHandlerRegistry(rpcExtensionMock);

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
  const statSpy = vi.spyOn(fs.promises, 'stat');
  const info: Stats = {} as Stats;
  info.size = 32000;
  info.mtime = now;
  statSpy.mockResolvedValue(info);
  const readdirMock = vi.spyOn(fs.promises, 'readdir') as unknown as MockInstance<
    (path: string) => Promise<string[] | fs.Dirent[]>
  >;
  readdirMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return Promise.resolve([base + '-model']);
    } else {
      return Promise.resolve(dirent);
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
    rpcExtensionMock,
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
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

test('getModelsInfo should return an empty array if the models folder does not exist', async () => {
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
    rpcExtensionMock,
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
  manager.init();
  await manager.getLocalModelsFromDisk();
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
  const statSpy = vi.spyOn(fs.promises, 'stat') as unknown as MockInstance<(path: PathLike) => Promise<Stats>>;
  statSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return Promise.resolve({ isDirectory: () => true } as Stats);
  });

  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    rpcExtensionMock,
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
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
  const statSpy = vi.spyOn(fs.promises, 'stat') as unknown as MockInstance<(path: PathLike) => Promise<Stats>>;
  statSpy.mockImplementation((path: PathLike) => {
    if (`${path}`.endsWith('model-id-1')) throw new Error('random-error');
    return Promise.resolve({ isDirectory: () => true } as Stats);
  });

  const readdirMock = vi.spyOn(fs.promises, 'readdir') as unknown as MockInstance<
    (path: string) => Promise<string[] | fs.Dirent[]>
  >;
  readdirMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return Promise.resolve([base + '-model.tmp']);
    } else {
      return Promise.resolve(dirent);
    }
  });

  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    rpcExtensionMock,
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
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

  let modelsDir: string;
  if (process.platform === 'win32') {
    modelsDir = 'C:\\home\\user\\aistudio\\models';
  } else {
    modelsDir = '/home/user/aistudio/models';
  }
  const manager = new ModelsManager(
    rpcExtensionMock,
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
  manager.init();
  await manager.loadLocalModels();
  expect(rpcExtensionMock.fire).toHaveBeenNthCalledWith(2, MSG_NEW_MODELS_STATE, [
    {
      file: {
        creation: now,
        file: 'model-id-1-model',
        size: 32000,
        path: path.resolve(dirent[0].path, dirent[0].name),
      },
      id: 'model-id-1',
    },
  ]);
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
  const manager = new ModelsManager(
    rpcExtensionMock,
    {
      getModels: () => {
        return [
          {
            id: 'model-id-1',
            url: 'https:///model-url',
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
    modelHandlerRegistry,
  );
  modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
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
  expect(rpcExtensionMock.fire).toHaveBeenCalledTimes(5);
  // check that a new state is sent with the model removed
  expect(rpcExtensionMock.fire).toHaveBeenNthCalledWith(4, MSG_NEW_MODELS_STATE, [
    {
      id: 'model-id-1',
      url: 'https:///model-url',
    },
  ]);
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
    const manager = new ModelsManager(
      rpcExtensionMock,
      {
        getModels: () => {
          return [
            {
              id: 'model-id-1',
              url: 'https://model-url',
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
      modelHandlerRegistry,
    );
    modelHandlerRegistry.register(new URLModelHandler(manager, modelsDir));
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
    expect(rpcExtensionMock.fire).toHaveBeenCalledTimes(5);
    // check that a new state is sent with the model non removed
    expect(rpcExtensionMock.fire).toHaveBeenNthCalledWith(4, MSG_NEW_MODELS_STATE, [
      {
        id: 'model-id-1',
        url: 'https://model-url',
        file: {
          creation: now,
          file: 'model-id-1-model',
          size: 32000,
          path: path.resolve(dirent[0].path, dirent[0].name),
        },
      },
    ]);
    expect(mocks.showErrorMessageMock).toHaveBeenCalledOnce();
    expect(mocks.logErrorMock).toHaveBeenCalled();
  });

  test('delete local model should call catalogManager', async () => {
    vi.mocked(env).isWindows = false;
    const removeUserModelMock = vi.fn();
    const manager = new ModelsManager(
      rpcExtensionMock,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
    );
    modelHandlerRegistry.register(new URLModelHandler(manager, 'appdir'));

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);
    const updateTaskMock = vi.spyOn(taskRegistry, 'updateTask');
    await manager.requestDownloadModel({
      id: 'id',
      url: 'https:///url',
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
    );
    modelHandlerRegistry.register(new URLModelHandler(manager, 'appdir'));

    vi.spyOn(manager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'https:///url',
      name: 'name',
    } as ModelInfo);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'https:///url',
      name: 'name',
    } as ModelInfo);

    // Only called once
    expect(mocks.performDownloadMock).toHaveBeenCalledTimes(1);
    expect(mocks.onEventDownloadMock).toHaveBeenCalledTimes(1);
  });

  test('multiple download request same model - second call before first completed', async () => {
    mocks.getDownloaderCompleter.mockReturnValue(false);

    const manager = new ModelsManager(
      rpcExtensionMock,
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
      modelHandlerRegistry,
    );
    modelHandlerRegistry.register(new URLModelHandler(manager, 'appdir'));

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
      url: 'https:///url',
      name: 'name',
    } as ModelInfo);

    await manager.requestDownloadModel({
      id: 'id',
      url: 'https:///url',
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
      rpcExtensionMock,
      {
        getModels: (): ModelInfo[] => [],
      } as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
      modelHandlerRegistry,
    );

    await expect(() => manager.getModelMetadata('unknown-model-id')).rejects.toThrowError(
      'model with id unknown-model-id does not exists.',
    );
  });

  test('remote model', async () => {
    const manager = new ModelsManager(
      {} as RpcExtension,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
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
      modelHandlerRegistry,
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
      rpcExtensionMock,
      {
        onUpdate: vi.fn(),
        getModels: () => [],
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
      modelHandlerRegistry,
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
      rpcExtensionMock,
      {
        onUpdate: vi.fn(),
        getModels: () => [],
      } as unknown as CatalogManager,
      telemetryLogger,
      taskRegistry,
      cancellationTokenRegistryMock,
      podmanConnectionMock,
      configurationRegistryMock,
      modelHandlerRegistry,
    );

    manager.init();
    await manager.uploadModelToPodmanMachine(connectionMock, modelMock);
    expect(Uploader).not.toHaveBeenCalled();
  });
});
