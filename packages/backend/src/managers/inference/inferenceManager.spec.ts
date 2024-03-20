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
import {
  containerEngine,
  provider,
  type Webview,
  type TelemetryLogger,
  type ImageInfo,
  type ContainerInfo,
  type ContainerInspectInfo,
  type ProviderContainerConnection,
} from '@podman-desktop/api';
import type { ContainerRegistry } from '../../registries/ContainerRegistry';
import type { PodmanConnection } from '../podmanConnection';
import { beforeEach, expect, describe, test, vi } from 'vitest';
import { InferenceManager } from './inferenceManager';
import type { ModelsManager } from '../modelsManager';
import { LABEL_INFERENCE_SERVER, INFERENCE_SERVER_IMAGE } from '../../utils/inferenceUtils';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { TaskRegistry } from '../../registries/TaskRegistry';

vi.mock('@podman-desktop/api', async () => {
  return {
    containerEngine: {
      startContainer: vi.fn(),
      stopContainer: vi.fn(),
      listContainers: vi.fn(),
      inspectContainer: vi.fn(),
      pullImage: vi.fn(),
      listImages: vi.fn(),
      createContainer: vi.fn(),
      deleteContainer: vi.fn(),
    },
    Disposable: {
      from: vi.fn(),
      create: vi.fn(),
    },
    provider: {
      getContainerConnections: vi.fn(),
    },
  };
});

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

const containerRegistryMock = {
  onStartContainerEvent: vi.fn(),
  subscribe: vi.fn(),
} as unknown as ContainerRegistry;

const podmanConnectionMock = {
  onMachineStart: vi.fn(),
  onMachineStop: vi.fn(),
} as unknown as PodmanConnection;

const modelsManager = {} as unknown as ModelsManager;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const taskRegistryMock = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTasksByLabels: vi.fn(),
} as unknown as TaskRegistry;

const getInitializedInferenceManager = async (): Promise<InferenceManager> => {
  const manager = new InferenceManager(
    webviewMock,
    containerRegistryMock,
    podmanConnectionMock,
    modelsManager,
    telemetryMock,
    taskRegistryMock,
  );
  manager.init();
  await vi.waitUntil(manager.isInitialize.bind(manager), {
    interval: 200,
    timeout: 2000,
  });
  return manager;
};

const mockListContainers = (containers: Partial<ContainerInfo>[]): void => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue(containers as unknown as ContainerInfo[]);
};

beforeEach(() => {
  vi.resetAllMocks();
  // Default listContainers is empty
  mockListContainers([]);
  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);
  vi.mocked(containerEngine.inspectContainer).mockResolvedValue({
    State: {
      Status: 'running',
      Health: undefined,
    },
  } as unknown as ContainerInspectInfo);
  vi.mocked(provider.getContainerConnections).mockReturnValue([
    {
      providerId: 'test@providerId',
      connection: {
        type: 'podman',
        name: 'test@connection',
        status: () => 'started',
      },
    } as unknown as ProviderContainerConnection,
  ]);
  vi.mocked(containerEngine.listImages).mockResolvedValue([
    {
      Id: 'dummyImageId',
      engineId: 'dummyEngineId',
      RepoTags: [INFERENCE_SERVER_IMAGE],
    },
  ] as unknown as ImageInfo[]);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummyCreatedContainerId',
  });
  vi.mocked(taskRegistryMock.getTasksByLabels).mockReturnValue([]);
});

/**
 * Testing the initialization of the manager
 */
describe('init Inference Manager', () => {
  test('should be initialized', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    expect(inferenceManager.isInitialize()).toBeTruthy();
  });

  test('should have listed containers', async () => {
    const inferenceManager = await getInitializedInferenceManager();

    expect(inferenceManager.isInitialize()).toBeTruthy();
    expect(containerEngine.listContainers).toHaveBeenCalled();
  });

  test('should ignore containers without the proper label', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
      },
    ]);

    const inferenceManager = await getInitializedInferenceManager();
    expect(inferenceManager.getServers().length).toBe(0);
  });

  test('should have adopted the existing container', async () => {
    mockListContainers([
      {
        Id: 'dummyContainerId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);

    const inferenceManager = await getInitializedInferenceManager();
    expect(inferenceManager.getServers()).toStrictEqual([
      {
        connection: {
          port: -1,
        },
        container: {
          containerId: 'dummyContainerId',
          engineId: 'dummyEngineId',
        },
        health: undefined,
        models: [],
        status: 'running',
      },
    ]);
  });

  test('should have adopted all existing container with proper label', async () => {
    mockListContainers([
      {
        Id: 'dummyContainerId-1',
        engineId: 'dummyEngineId-1',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
      {
        Id: 'dummyContainerId-2',
        engineId: 'dummyEngineId-2',
      },
      {
        Id: 'dummyContainerId-3',
        engineId: 'dummyEngineId-3',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);

    const inferenceManager = await getInitializedInferenceManager();
    const servers = inferenceManager.getServers();
    expect(servers.length).toBe(2);
    expect(servers.some(server => server.container.containerId === 'dummyContainerId-1')).toBeTruthy();
    expect(servers.some(server => server.container.containerId === 'dummyContainerId-3')).toBeTruthy();
  });
});

/**
 * Testing the creation logic
 */
describe('Create Inference Server', () => {
  test('unknown providerId', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer(
        {
          providerId: 'unknown',
        } as unknown as InferenceServerConfig,
        'dummyTrackingId',
      ),
    ).rejects.toThrowError('cannot find any started container provider.');

    expect(provider.getContainerConnections).toHaveBeenCalled();
  });

  test('unknown imageId', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer(
        {
          providerId: 'test@providerId',
          image: 'unknown',
        } as unknown as InferenceServerConfig,
        'dummyTrackingId',
      ),
    ).rejects.toThrowError('image unknown not found.');

    expect(containerEngine.listImages).toHaveBeenCalled();
  });

  test('empty modelsInfo', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer(
        {
          providerId: 'test@providerId',
          image: INFERENCE_SERVER_IMAGE,
          modelsInfo: [],
        } as unknown as InferenceServerConfig,
        'dummyTrackingId',
      ),
    ).rejects.toThrowError('Need at least one model info to start an inference server.');
  });

  test('modelInfo without file', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer(
        {
          providerId: 'test@providerId',
          image: INFERENCE_SERVER_IMAGE,
          modelsInfo: [
            {
              id: 'dummyModelId',
            },
          ],
        } as unknown as InferenceServerConfig,
        'dummyTrackingId',
      ),
    ).rejects.toThrowError('The model info file provided is undefined');
  });

  test('valid InferenceServerConfig', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.createInferenceServer(
      {
        port: 8888,
        providerId: 'test@providerId',
        image: INFERENCE_SERVER_IMAGE,
        modelsInfo: [
          {
            id: 'dummyModelId',
            file: {
              file: 'dummyFile',
              path: 'dummyPath',
            },
          },
        ],
      } as unknown as InferenceServerConfig,
      'dummyTrackingId',
    );

    expect(taskRegistryMock.createTask).toHaveBeenNthCalledWith(
      1,
      'Pulling ghcr.io/projectatomic/ai-studio-playground-images/ai-studio-playground-chat:0.1.0.',
      'loading',
      {
        trackingId: 'dummyTrackingId',
      },
    );
    expect(taskRegistryMock.createTask).toHaveBeenNthCalledWith(2, 'Creating container.', 'loading', {
      trackingId: 'dummyTrackingId',
    });
    expect(taskRegistryMock.updateTask).toHaveBeenLastCalledWith({
      state: 'success',
    });
    expect(containerEngine.createContainer).toHaveBeenCalled();
    expect(inferenceManager.getServers()).toStrictEqual([
      {
        connection: {
          port: 8888,
        },
        container: {
          containerId: 'dummyCreatedContainerId',
          engineId: 'dummyEngineId',
        },
        models: [
          {
            file: {
              file: 'dummyFile',
              path: 'dummyPath',
            },
            id: 'dummyModelId',
          },
        ],
        status: 'running',
      },
    ]);
  });
});

/**
 * Testing the starting logic
 */
describe('Start Inference Server', () => {
  test('containerId unknown', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(inferenceManager.startInferenceServer('unknownContainerId')).rejects.toThrowError(
      'cannot find a corresponding server for container id unknownContainerId.',
    );
  });

  test('valid containerId', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.startInferenceServer('dummyId');

    expect(containerEngine.startContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyId');

    const servers = inferenceManager.getServers();
    expect(servers.length).toBe(1);
    expect(servers[0].status).toBe('running');
  });
});

/**
 * Testing the stopping logic
 */
describe('Stop Inference Server', () => {
  test('containerId unknown', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(inferenceManager.stopInferenceServer('unknownContainerId')).rejects.toThrowError(
      'cannot find a corresponding server for container id unknownContainerId.',
    );
  });

  test('valid containerId', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.stopInferenceServer('dummyId');

    expect(containerEngine.stopContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyId');

    const servers = inferenceManager.getServers();
    expect(servers.length).toBe(1);
    expect(servers[0].status).toBe('stopped');
  });
});

describe('Delete Inference Server', () => {
  test('containerId unknown', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    await expect(inferenceManager.deleteInferenceServer('unknownContainerId')).rejects.toThrowError(
      'cannot find a corresponding server for container id unknownContainerId.',
    );
  });

  test('valid running containerId', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.deleteInferenceServer('dummyId');

    expect(containerEngine.stopContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyId');
    expect(containerEngine.deleteContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyId');

    const servers = inferenceManager.getServers();
    expect(servers.length).toBe(0);
  });

  test('valid stopped containerId', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    vi.mocked(containerEngine.inspectContainer).mockResolvedValue({
      State: {
        Status: 'stopped',
        Health: undefined,
      },
    } as unknown as ContainerInspectInfo);

    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.deleteInferenceServer('dummyId');

    expect(containerEngine.stopContainer).not.toHaveBeenCalled();
    expect(containerEngine.deleteContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyId');

    const servers = inferenceManager.getServers();
    expect(servers.length).toBe(0);
  });
});

describe('Request Create Inference Server', () => {
  test('Should return unique string identifier', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    const identifier = inferenceManager.requestCreateInferenceServer({
      port: 8888,
      providerId: 'test@providerId',
      image: 'quay.io/bootsy/playground:v0',
      modelsInfo: [
        {
          id: 'dummyModelId',
          file: {
            file: 'dummyFile',
            path: 'dummyPath',
          },
        },
      ],
    } as unknown as InferenceServerConfig);
    expect(identifier).toBeDefined();
    expect(typeof identifier).toBe('string');
  });

  test('Task registry should have tasks matching unique identifier provided', async () => {
    const inferenceManager = await getInitializedInferenceManager();
    const identifier = inferenceManager.requestCreateInferenceServer({
      port: 8888,
      providerId: 'test@providerId',
      image: 'quay.io/bootsy/playground:v0',
      modelsInfo: [
        {
          id: 'dummyModelId',
          file: {
            file: 'dummyFile',
            path: 'dummyPath',
          },
        },
      ],
    } as unknown as InferenceServerConfig);

    expect(taskRegistryMock.createTask).toHaveBeenNthCalledWith(1, 'Creating Inference server', 'loading', {
      trackingId: identifier,
    });
  });

  test('Pull image error should be reflected in task registry', async () => {
    vi.mocked(containerEngine.pullImage).mockRejectedValue(new Error('dummy pull image error'));

    const inferenceManager = await getInitializedInferenceManager();
    inferenceManager.requestCreateInferenceServer({
      port: 8888,
      providerId: 'test@providerId',
      image: 'quay.io/bootsy/playground:v0',
      modelsInfo: [
        {
          id: 'dummyModelId',
          file: {
            file: 'dummyFile',
            path: 'dummyPath',
          },
        },
      ],
    } as unknown as InferenceServerConfig);

    await vi.waitFor(() => {
      expect(taskRegistryMock.updateTask).toHaveBeenLastCalledWith({
        state: 'error',
        error: 'Something went wrong while trying to create an inference server Error: dummy pull image error.',
      });
    });
  });
});
