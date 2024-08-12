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
  type ContainerInfo,
  type ContainerInspectInfo,
  type TelemetryLogger,
  type Webview,
} from '@podman-desktop/api';
import type { ContainerRegistry } from '../../registries/ContainerRegistry';
import type { PodmanConnection } from '../podmanConnection';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { InferenceManager } from './inferenceManager';
import type { ModelsManager } from '../modelsManager';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { Messages } from '@shared/Messages';
import type { InferenceProviderRegistry } from '../../registries/InferenceProviderRegistry';
import type { InferenceProvider } from '../../workers/provider/InferenceProvider';
import type { CatalogManager } from '../catalogManager';
import type { InferenceServer } from '@shared/src/models/IInference';
import { InferenceType } from '@shared/src/models/IInference';

vi.mock('@podman-desktop/api', async () => {
  return {
    containerEngine: {
      startContainer: vi.fn(),
      stopContainer: vi.fn(),
      inspectContainer: vi.fn(),
      deleteContainer: vi.fn(),
      listContainers: vi.fn(),
    },
    Disposable: {
      from: vi.fn(),
      create: vi.fn(),
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
  onPodmanConnectionEvent: vi.fn(),
} as unknown as PodmanConnection;

const modelsManager = {
  getLocalModelPath: vi.fn(),
  uploadModelToPodmanMachine: vi.fn(),
} as unknown as ModelsManager;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const taskRegistryMock = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  getTasksByLabels: vi.fn(),
} as unknown as TaskRegistry;

const inferenceProviderRegistryMock = {
  getAll: vi.fn(),
  getByType: vi.fn(),
  get: vi.fn(),
} as unknown as InferenceProviderRegistry;

const catalogManager = {
  onUpdate: vi.fn(),
} as unknown as CatalogManager;

const getInitializedInferenceManager = async (): Promise<InferenceManager> => {
  const manager = new InferenceManager(
    webviewMock,
    containerRegistryMock,
    podmanConnectionMock,
    modelsManager,
    telemetryMock,
    taskRegistryMock,
    inferenceProviderRegistryMock,
    catalogManager,
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
  vi.mocked(webviewMock.postMessage).mockResolvedValue(true);
  vi.mocked(containerEngine.inspectContainer).mockResolvedValue({
    State: {
      Status: 'running',
      Health: undefined,
    },
  } as unknown as ContainerInspectInfo);
  vi.mocked(taskRegistryMock.getTasksByLabels).mockReturnValue([]);
  vi.mocked(modelsManager.getLocalModelPath).mockReturnValue('/local/model.guff');
  vi.mocked(modelsManager.uploadModelToPodmanMachine).mockResolvedValue('/mnt/path/model.guff');
});

/**
 * Testing the initialization of the manager
 */
describe('init Inference Manager', () => {
  test('should be initialized without catalog events', async () => {
    const manager = new InferenceManager(
      webviewMock,
      containerRegistryMock,
      podmanConnectionMock,
      modelsManager,
      telemetryMock,
      taskRegistryMock,
      inferenceProviderRegistryMock,
      catalogManager,
    );
    manager.init();
    await vi.waitUntil(manager.isInitialize.bind(manager), {
      interval: 200,
      timeout: 2000,
    });
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
        type: expect.anything(),
        labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
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
  test('no provider available should throw an error', async () => {
    vi.mocked(inferenceProviderRegistryMock.getByType).mockReturnValue([]);

    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer({
        inferenceProvider: undefined,
        labels: {},
        modelsInfo: [],
        port: 8888,
      }),
    ).rejects.toThrowError('no enabled provider could be found.');
  });

  test('inference provider provided should use get from InferenceProviderRegistry', async () => {
    vi.mocked(inferenceProviderRegistryMock.get).mockReturnValue({
      enabled: () => false,
    } as unknown as InferenceProvider);

    const inferenceManager = await getInitializedInferenceManager();
    await expect(
      inferenceManager.createInferenceServer({
        inferenceProvider: 'dummy-inference-provider',
        labels: {},
        modelsInfo: [],
        port: 8888,
      }),
    ).rejects.toThrowError('provider requested is not enabled.');
    expect(inferenceProviderRegistryMock.get).toHaveBeenCalledWith('dummy-inference-provider');
  });

  test('selected inference provider should receive config', async () => {
    const provider: InferenceProvider = {
      enabled: () => true,
      name: 'dummy-inference-provider',
      dispose: () => {},
      perform: vi.fn<() => InferenceServer>().mockResolvedValue({
        container: {
          containerId: 'dummy-container-id',
          engineId: 'dummy-engine-id',
        },
        models: [],
        status: 'running',
        type: InferenceType.LLAMA_CPP,
        connection: { port: 0 },
        labels: {},
      }),
    } as unknown as InferenceProvider;
    vi.mocked(inferenceProviderRegistryMock.get).mockReturnValue(provider);

    const inferenceManager = await getInitializedInferenceManager();

    const config: InferenceServerConfig = {
      inferenceProvider: 'dummy-inference-provider',
      labels: {},
      modelsInfo: [],
      port: 8888,
    };
    const result = await inferenceManager.createInferenceServer(config);

    expect(provider.perform).toHaveBeenCalledWith(config);

    expect(result).toBe('dummy-container-id');
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
});

describe('containerRegistry events', () => {
  test('container die event', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    const disposableMock = vi.fn();
    const deferred = new Promise<(status: string) => void>((resolve, reject) => {
      vi.mocked(containerRegistryMock.subscribe).mockImplementation((containerId, listener) => {
        if (containerId !== 'dummyId') reject(new Error('invalid container id'));
        else resolve(listener);
        return {
          dispose: disposableMock,
        };
      });
    });

    const inferenceManager = await getInitializedInferenceManager();
    const listener = await deferred;

    const server = inferenceManager.get('dummyId');
    expect(server?.status).toBe('running');
    expect(containerEngine.inspectContainer).toHaveBeenCalledOnce();

    vi.mocked(containerEngine.inspectContainer).mockResolvedValue({
      State: {
        Status: 'stopped',
        Health: undefined,
      },
    } as unknown as ContainerInspectInfo);

    listener('die');

    await vi.waitFor(() => {
      expect(inferenceManager.get('dummyId')?.status).toBe('stopped');
      expect(containerEngine.inspectContainer).toHaveBeenCalledTimes(2);
    });

    // we should not have disposed the subscriber, as the container is only stopped, not removed
    expect(disposableMock).not.toHaveBeenCalled();
  });

  test('container remove event', async () => {
    mockListContainers([
      {
        Id: 'dummyId',
        engineId: 'dummyEngineId',
        Labels: {
          [LABEL_INFERENCE_SERVER]: '[]',
        },
      },
    ]);
    const disposableMock = vi.fn();
    const deferred = new Promise<(status: string) => void>((resolve, reject) => {
      vi.mocked(containerRegistryMock.subscribe).mockImplementation((containerId, listener) => {
        if (containerId !== 'dummyId') reject(new Error('invalid container id'));
        else resolve(listener);
        return {
          dispose: disposableMock,
        };
      });
    });

    const inferenceManager = await getInitializedInferenceManager();
    const listener = await deferred;

    const server = inferenceManager.get('dummyId');
    expect(server?.status).toBe('running');

    listener('remove');

    await vi.waitFor(() => {
      expect(inferenceManager.get('dummyId')).toBeUndefined();
    });

    // we should have disposed the subscriber, as the container is removed
    expect(disposableMock).toHaveBeenCalled();
  });
});

describe('transition statuses', () => {
  test('stopping an inference server should first set status to stopping', async () => {
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
        Status: 'running',
        Health: undefined,
      },
    } as unknown as ContainerInspectInfo);

    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.stopInferenceServer('dummyId');

    // first called with stopping status
    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_INFERENCE_SERVERS_UPDATE,
      body: [
        {
          connection: expect.anything(),
          container: expect.anything(),
          models: expect.anything(),
          health: undefined,
          status: 'stopping',
          type: expect.anything(),
          labels: expect.anything(),
        },
      ],
    });

    // finally have been called with status stopped
    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_INFERENCE_SERVERS_UPDATE,
      body: [
        {
          connection: expect.anything(),
          container: expect.anything(),
          models: expect.anything(),
          health: undefined,
          status: 'stopped',
          type: expect.anything(),
          labels: expect.anything(),
        },
      ],
    });
  });

  test('deleting an inference server should first set status to stopping', async () => {
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
        Status: 'running',
        Health: undefined,
      },
    } as unknown as ContainerInspectInfo);

    const inferenceManager = await getInitializedInferenceManager();
    await inferenceManager.deleteInferenceServer('dummyId');

    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_INFERENCE_SERVERS_UPDATE,
      body: [
        {
          connection: expect.anything(),
          container: expect.anything(),
          models: expect.anything(),
          health: undefined,
          status: 'deleting',
          type: expect.anything(),
          labels: expect.anything(),
        },
      ],
    });
  });

  test('starting an inference server should first set status to stopping', async () => {
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
    await inferenceManager.startInferenceServer('dummyId');

    // first status must be set to starting
    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_INFERENCE_SERVERS_UPDATE,
      body: [
        {
          connection: expect.anything(),
          container: expect.anything(),
          models: expect.anything(),
          health: undefined,
          status: 'starting',
          type: expect.anything(),
          labels: expect.anything(),
        },
      ],
    });

    // on success it should have been set to running
    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_INFERENCE_SERVERS_UPDATE,
      body: [
        {
          connection: expect.anything(),
          container: expect.anything(),
          models: expect.anything(),
          health: undefined,
          status: 'running',
          type: expect.anything(),
          labels: expect.anything(),
        },
      ],
    });
  });
});
