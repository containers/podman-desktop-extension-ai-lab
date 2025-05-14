/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { TaskRegistry } from '../../registries/TaskRegistry';
import { assert, beforeEach, expect, test, vi } from 'vitest';
import type { ContainerCreateResult, ContainerInfo, Disposable, ImageInfo, TelemetryLogger } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { PodmanConnection } from '../podmanConnection';
import type { ContainerRegistry } from '../../registries/ContainerRegistry';
import { VMType } from '@shared/models/IPodman';
import type { Task } from '@shared/models/ITask';
import llama_stack_images from '../../assets/llama-stack-images.json';
import llama_stack_playground_images from '../../assets/llama-stack-playground-images.json';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { LLAMA_STACK_API_PORT_LABEL, LLAMA_STACK_CONTAINER_LABEL, LlamaStackManager } from './llamaStackManager';
import {
  LLAMA_STACK_CONTAINER_TRACKINGID,
  type LlamaStackContainerInfo,
} from '@shared/models/llama-stack/LlamaStackContainerInfo';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import type { ExtensionConfiguration } from '@shared/models/IExtensionConfiguration';
import type { ModelsManager } from '../modelsManager';
import * as utilsPorts from '../../utils/ports';

vi.mock('@podman-desktop/api', () => {
  return {
    EventEmitter: vi.fn(),
    containerEngine: {
      listContainers: vi.fn(),
      listImages: vi.fn(),
      createContainer: vi.fn(),
      onEvent: vi.fn(),
      pullImage: vi.fn(),
    },
    env: {
      isWindows: false,
    },
  };
});

vi.mock('../../utils/ports');

class TestLlamaStackManager extends LlamaStackManager {
  public override async refreshLlamaStackContainer(): Promise<void> {
    return super.refreshLlamaStackContainer();
  }

  public override getContainerInfo(): LlamaStackContainerInfo | undefined {
    return super.getContainerInfo();
  }
}

const podmanConnection: PodmanConnection = {
  onPodmanConnectionEvent: vi.fn(),
  findRunningContainerProviderConnection: vi.fn(),
  execute: vi.fn(),
} as unknown as PodmanConnection;

const containerRegistry = {
  onStartContainerEvent: vi.fn(),
  onStopContainerEvent: vi.fn(),
  onHealthyContainerEvent: vi.fn(),
} as unknown as ContainerRegistry;

const configurationRegistry = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const modelsManagerMock = {
  getModelsInfo: vi.fn(),
} as unknown as ModelsManager;

let taskRegistry: TaskRegistry;

let llamaStackManager: TestLlamaStackManager;

const LLAMA_STACK_CONTAINER_RUNNING = {
  Id: 'dummyId',
  State: 'running',
  Labels: {
    [LLAMA_STACK_CONTAINER_LABEL]: 'dummyLabel',
    [LLAMA_STACK_API_PORT_LABEL]: '50000',
  },
} as unknown as ContainerInfo;

const LLAMA_STACK_CONTAINER_STOPPED = {
  Id: 'dummyId',
  State: 'stopped',
} as unknown as ContainerInfo;

const NON_LLAMA_STACK_CONTAINER = { Id: 'dummyId' } as unknown as ContainerInfo;

const NO_OP_DISPOSABLE = {
  dispose: (): void => {},
} as Disposable;

beforeEach(() => {
  vi.resetAllMocks();
  taskRegistry = new TaskRegistry({ fire: vi.fn().mockResolvedValue(true) } as unknown as RpcExtension);
  llamaStackManager = new TestLlamaStackManager(
    '',
    taskRegistry,
    podmanConnection,
    containerRegistry,
    configurationRegistry,
    telemetryMock,
    modelsManagerMock,
  );
});

test('getLlamaStackContainer should return undefined if no containers', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  const containerId = await llamaStackManager.getLlamaStackContainer();
  expect(containerId).toBeUndefined();
});

test('getLlamaStackContainer should return undefined if no llama stack container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([NON_LLAMA_STACK_CONTAINER]);
  const containerId = await llamaStackManager.getLlamaStackContainer();
  expect(containerId).toBeUndefined();
});

test('getLlamaStackContainer should return id if instructlab container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([LLAMA_STACK_CONTAINER_RUNNING]);
  const containerInfo = await llamaStackManager.getLlamaStackContainer();
  expect(containerInfo).toEqual({ containerId: 'dummyId', port: 50000, playgroundPort: 0 });
});

test('requestCreateLlamaStackContainer throws error if no podman connection', async () => {
  const containerIdPromise = llamaStackManager.requestCreateLlamaStackContainer({});
  await expect(containerIdPromise).rejects.toBeInstanceOf(Error);
});

async function waitTasks(id: string, nb: number): Promise<Task[]> {
  return vi.waitFor(() => {
    const tasks = taskRegistry.getTasksByLabels({ trackingId: id });
    if (tasks.length < nb) {
      throw new Error('not completed');
    }
    return tasks.slice(0, nb);
  });
}

test('requestCreateLlamaStackContainer returns id and error if listImage returns error', async () => {
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listImages).mockRejectedValue(new Error());
  await llamaStackManager.requestCreateLlamaStackContainer({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 2);
  expect(tasks.some(task => task.state === 'error')).toBeTruthy();
});

test('requestCreateLlamaStackContainer returns id and error if listImage returns image', async () => {
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listImages).mockResolvedValue([
    { RepoTags: [llama_stack_images.default] } as unknown as ImageInfo,
  ]);
  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    apiPort: 10000,
  } as ExtensionConfiguration);
  await llamaStackManager.requestCreateLlamaStackContainer({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 3);
  expect(tasks.some(task => task.state === 'error')).toBeTruthy();
});

test('requestCreateLlamaStackContainer returns no error if createContainer returns id and container becomes healthy', async () => {
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listImages).mockResolvedValue([
    { RepoTags: [llama_stack_images.default] } as unknown as ImageInfo,
  ]);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'containerId',
  } as unknown as ContainerCreateResult);
  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    apiPort: 10000,
  } as ExtensionConfiguration);
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockReturnValue(NO_OP_DISPOSABLE);
  await llamaStackManager.requestCreateLlamaStackContainer({});
  await vi.waitFor(() => {
    const healthyListener = vi.mocked(containerRegistry.onHealthyContainerEvent).mock.calls[0][0];
    expect(healthyListener).toBeDefined();
    healthyListener({ id: 'containerId' });
  });
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 4);
  expect(tasks.some(task => task.state === 'error')).toBeFalsy();
});

test('requestCreateLlamaStackContainer registers all local models', async () => {
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listImages).mockResolvedValue([
    { RepoTags: [llama_stack_images.default, llama_stack_playground_images.default] } as unknown as ImageInfo,
  ]);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'containerId',
  } as unknown as ContainerCreateResult);
  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    apiPort: 10000,
  } as ExtensionConfiguration);
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockReturnValue(NO_OP_DISPOSABLE);
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      id: 'model1',
      name: 'Model 1',
      description: '',
      file: { file: 'model1', path: '/path/to' },
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: '',
      file: { file: 'model2', path: '/path/to' },
    },
    {
      id: 'model3',
      name: 'Model 3',
      description: '',
    },
  ]);
  vi.mocked(containerEngine.pullImage).mockResolvedValue();
  await llamaStackManager.requestCreateLlamaStackContainer({});
  await vi.waitFor(() => {
    const healthyListener = vi.mocked(containerRegistry.onHealthyContainerEvent).mock.calls[0][0];
    expect(healthyListener).toBeDefined();
    healthyListener({ id: 'containerId' });
  });
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 6);
  expect(tasks.some(task => task.state === 'error')).toBeFalsy();
  await vi.waitFor(() => {
    expect(podmanConnection.execute).toHaveBeenCalledTimes(2);
  });
  expect(podmanConnection.execute).toHaveBeenCalledWith(expect.anything(), [
    'exec',
    'containerId',
    'llama-stack-client',
    'models',
    'register',
    'Model 1',
  ]);
  expect(podmanConnection.execute).toHaveBeenCalledWith(expect.anything(), [
    'exec',
    'containerId',
    'llama-stack-client',
    'models',
    'register',
    'Model 2',
  ]);
});

test('requestCreateLlamaStackContainer creates playground container', async () => {
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listImages).mockResolvedValue([
    { RepoTags: [llama_stack_images.default, llama_stack_playground_images.default] } as unknown as ImageInfo,
  ]);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'containerId',
  } as unknown as ContainerCreateResult);
  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    apiPort: 10000,
  } as ExtensionConfiguration);
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockReturnValue(NO_OP_DISPOSABLE);
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      id: 'model1',
      name: 'Model 1',
      description: '',
      file: { file: 'model1', path: '/path/to' },
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: '',
      file: { file: 'model2', path: '/path/to' },
    },
    {
      id: 'model3',
      name: 'Model 3',
      description: '',
    },
  ]);
  vi.mocked(containerEngine.pullImage).mockResolvedValue();
  vi.mocked(utilsPorts.getFreeRandomPort).mockResolvedValue(1234);
  await llamaStackManager.requestCreateLlamaStackContainer({});
  await vi.waitFor(() => {
    const healthyListener = vi.mocked(containerRegistry.onHealthyContainerEvent).mock.calls[0][0];
    expect(healthyListener).toBeDefined();
    healthyListener({ id: 'containerId' });
  });
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 7);
  expect(tasks.some(task => task.state === 'error')).toBeFalsy();
  expect(containerEngine.createContainer).toHaveBeenCalledTimes(2);
  expect(containerEngine.createContainer).toHaveBeenNthCalledWith(
    2,
    undefined,
    expect.objectContaining({
      Env: ['LLAMA_STACK_ENDPOINT=http://host.containers.internal:1234'],
      HostConfig: expect.objectContaining({
        PortBindings: {
          '8501/tcp': [
            {
              HostPort: '1234',
            },
          ],
        },
      }),
    }),
  );
});

test('onPodmanConnectionEvent start event should call refreshLlamaStackContainer and set containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainer');
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(podmanConnection.onPodmanConnectionEvent).mockImplementation(f => {
    f({
      status: 'started',
    });
    return NO_OP_DISPOSABLE;
  });

  llamaStackManager.init();

  expect(llamaStackManager.refreshLlamaStackContainer).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainerInfo()).toEqual({
      containerId: 'dummyId',
      port: 50000,
      playgroundPort: 0,
    });
  });
});

test('onPodmanConnectionEvent stop event should call refreshLlamaStackContainer and clear containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainer');
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(podmanConnection.onPodmanConnectionEvent).mockReturnValue(NO_OP_DISPOSABLE);

  llamaStackManager.init();
  const listener = vi.mocked(podmanConnection.onPodmanConnectionEvent).mock.calls[0][0];
  assert(listener, 'onPodmanConnectionEvent should have been called');

  listener({ status: 'started' });

  expect(llamaStackManager.refreshLlamaStackContainer).toHaveBeenCalledWith();
  await vi.waitFor(() => {
    expect(llamaStackManager.getContainerInfo()).toEqual({
      containerId: 'dummyId',
      port: 50000,
      playgroundPort: 0,
    });
  });

  vi.mocked(llamaStackManager.refreshLlamaStackContainer).mockClear();
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_STOPPED]);

  listener({ status: 'stopped' });

  expect(llamaStackManager.refreshLlamaStackContainer).toHaveBeenCalledWith();
  await vi.waitFor(async () => {
    expect(llamaStackManager.getContainerInfo()).toBeUndefined();
  });
});

test('onStartContainerEvent event should call refreshLlamaStackContainer and set containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainer');
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(containerRegistry.onStartContainerEvent).mockImplementation(f => {
    f({
      id: 'dummyId',
    });
    return NO_OP_DISPOSABLE;
  });

  llamaStackManager.init();

  expect(llamaStackManager.refreshLlamaStackContainer).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainerInfo()).toEqual({
      containerId: 'dummyId',
      port: 50000,
      playgroundPort: 0,
    });
  });
});

test('onStopContainerEvent event should call refreshLlamaStackContainer and clear containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainer');
  vi.spyOn(taskRegistry, 'deleteByLabels');
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(containerRegistry.onStartContainerEvent).mockImplementation(f => {
    f({
      id: 'dummyId',
    });
    return NO_OP_DISPOSABLE;
  });
  vi.mocked(containerRegistry.onStopContainerEvent).mockReturnValue(NO_OP_DISPOSABLE);

  llamaStackManager.init();

  expect(llamaStackManager.refreshLlamaStackContainer).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainerInfo()).toEqual({
      containerId: 'dummyId',
      port: 50000,
      playgroundPort: 0,
    });
  });

  vi.mocked(llamaStackManager.refreshLlamaStackContainer).mockClear();
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_STOPPED]);

  const listener = vi.mocked(containerRegistry.onStopContainerEvent).mock.calls[0][0];
  assert(listener, 'onStopContainerEvent should have been called');

  listener({ id: 'dummyId' });

  expect(taskRegistry.deleteByLabels).toHaveBeenCalled();
  await vi.waitFor(async () => {
    expect(llamaStackManager.getContainerInfo()).toBeUndefined();
  });
});
