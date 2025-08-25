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
import {
  LLAMA_STACK_API_PORT_LABEL,
  LLAMA_STACK_CONTAINER_LABEL,
  LLAMA_STACK_PLAYGROUND_PORT_LABEL,
  LlamaStackManager,
} from './llamaStackManager';
import {
  LLAMA_STACK_CONTAINER_TRACKINGID,
  type LlamaStackContainers,
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
      inspectContainer: vi.fn(),
      startContainer: vi.fn(),
      stopContainer: vi.fn(),
      deleteContainer: vi.fn(),
    },
    env: {
      isWindows: false,
    },
  };
});

vi.mock('../../utils/ports');

class TestLlamaStackManager extends LlamaStackManager {
  public override async refreshLlamaStackContainers(): Promise<void> {
    return super.refreshLlamaStackContainers();
  }

  public override getContainersInfo(): LlamaStackContainers | undefined {
    return super.getContainersInfo();
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

test('getLlamaStackContainers should return undefined if no containers', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  const stack_containers = await llamaStackManager.getLlamaStackContainers();
  expect(stack_containers).toEqual({ server: undefined, playground: undefined });
});

test('getLlamaStackContainers should return undefined if no llama stack container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([NON_LLAMA_STACK_CONTAINER]);
  const stack_containers = await llamaStackManager.getLlamaStackContainers();
  expect(stack_containers).toEqual({ server: undefined, playground: undefined });
});

test('getLlamaStackContainers should return server info if llama stack server container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([LLAMA_STACK_CONTAINER_RUNNING]);
  const containerInfo = await llamaStackManager.getLlamaStackContainers();
  expect(containerInfo).toEqual({
    server: { containerId: 'dummyId', port: 50000, state: 'running' },
    playground: undefined,
  });
});

test('requestcreateLlamaStackContainerss throws error if no podman connection', async () => {
  const containerIdPromise = llamaStackManager.requestcreateLlamaStackContainerss({});
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

test('requestcreateLlamaStackContainerss returns id and error if listImage returns error', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
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
  await llamaStackManager.requestcreateLlamaStackContainerss({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 2);
  expect(tasks.some(task => task.state === 'error')).toBeTruthy();
});

test('requestcreateLlamaStackContainerss returns id and error if listImage returns image', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
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
  await llamaStackManager.requestcreateLlamaStackContainerss({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 3);
  expect(tasks.some(task => task.state === 'error')).toBeTruthy();
});

test('requestcreateLlamaStackContainerss returns no error if createContainer returns id and container becomes healthy', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
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
    {
      RepoTags: [llama_stack_images.default, llama_stack_playground_images.default],
      Id: 'imageId',
      engineId: 'engine1',
    } as unknown as ImageInfo,
  ]);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'containerId',
  } as unknown as ContainerCreateResult);
  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    apiPort: 10000,
  } as ExtensionConfiguration);
  vi.mocked(utilsPorts.getFreeRandomPort).mockResolvedValueOnce(1234).mockResolvedValueOnce(5678);
  vi.mocked(containerEngine.pullImage).mockResolvedValue();
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([]);
  vi.mocked(podmanConnection.execute).mockResolvedValue({ stdout: '', stderr: '', command: '' });
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockImplementation(cb => {
    // Fire the callback immediately for testing
    setTimeout(() => cb({ id: 'containerId' }), 100);
    return NO_OP_DISPOSABLE;
  });
  await llamaStackManager.requestcreateLlamaStackContainerss({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 4);
  expect(tasks.some(task => task.state === 'error')).toBeFalsy();
});

test('requestcreateLlamaStackContainerss registers all local models', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
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
  vi.mocked(utilsPorts.getFreeRandomPort).mockResolvedValueOnce(1234).mockResolvedValueOnce(5678);
  vi.mocked(containerEngine.pullImage).mockResolvedValue();
  vi.mocked(podmanConnection.execute).mockResolvedValue({ stdout: '', stderr: '', command: '' });
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockImplementation(cb => {
    setTimeout(() => cb({ id: 'containerId' }), 100);
    return NO_OP_DISPOSABLE;
  });
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
  await llamaStackManager.requestcreateLlamaStackContainerss({});
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

test('requestcreateLlamaStackContainerss creates playground container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
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
  vi.mocked(utilsPorts.getFreeRandomPort).mockResolvedValueOnce(1234).mockResolvedValueOnce(5678);
  vi.mocked(containerEngine.pullImage).mockResolvedValue();
  vi.mocked(podmanConnection.execute).mockResolvedValue({ stdout: '', stderr: '', command: '' });
  vi.mocked(containerRegistry.onHealthyContainerEvent).mockImplementation(cb => {
    setTimeout(() => cb({ id: 'containerId' }), 100);
    return NO_OP_DISPOSABLE;
  });
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
  await llamaStackManager.requestcreateLlamaStackContainerss({});
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
              HostPort: '5678',
            },
          ],
        },
      }),
    }),
  );
});

test('requestcreateLlamaStackContainerss starts both if server and playground exist', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  const server = { Id: 'serverId', Labels: { [LLAMA_STACK_API_PORT_LABEL]: '50000' } } as unknown as ContainerInfo;
  const playground = {
    Id: 'playgroundId',
    Labels: { [LLAMA_STACK_PLAYGROUND_PORT_LABEL]: '60000' },
  } as unknown as ContainerInfo;

  vi.mocked(containerEngine.listContainers).mockResolvedValue([server, playground]);
  const startBothSpy = vi
    .spyOn(llamaStackManager as unknown as { startBoth: () => Promise<void> }, 'startBoth')
    .mockResolvedValue(undefined);

  await llamaStackManager.requestcreateLlamaStackContainerss({});

  expect(startBothSpy).toHaveBeenCalledWith(server, playground, expect.any(Object));
});

test('requestcreateLlamaStackContainerss creates playground if server exists but playground missing', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  const server = { Id: 'serverId', Labels: { [LLAMA_STACK_API_PORT_LABEL]: '50000' } } as unknown as ContainerInfo;

  vi.mocked(containerEngine.listContainers).mockResolvedValue([server]);
  const createPlaygroundSpy = vi
    .spyOn(
      llamaStackManager as unknown as { createPlaygroundFromServer: () => Promise<void> },
      'createPlaygroundFromServer',
    )
    .mockResolvedValue(undefined);

  await llamaStackManager.requestcreateLlamaStackContainerss({});

  expect(createPlaygroundSpy).toHaveBeenCalledWith(server, expect.any(Object), expect.anything());
});

test('requestcreateLlamaStackContainerss deletes existing playground and creates both if server missing', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  const playground = {
    Id: 'playgroundId',
    Labels: { [LLAMA_STACK_PLAYGROUND_PORT_LABEL]: '60000' },
  } as unknown as ContainerInfo;

  vi.mocked(containerEngine.listContainers).mockResolvedValue([playground]);
  const createBothSpy = vi
    .spyOn(llamaStackManager as unknown as { CreateBoth: () => Promise<void> }, 'CreateBoth')
    .mockResolvedValue(undefined);

  await llamaStackManager.requestcreateLlamaStackContainerss({});

  expect(createBothSpy).toHaveBeenCalledWith(playground, expect.any(Object), expect.anything());
});

test('requestcreateLlamaStackContainerss creates both if server and playground missing', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
    name: 'Podman Machine',
    vmType: VMType.UNKNOWN,
    type: 'podman',
    status: () => 'started',
    endpoint: {
      socketPath: 'socket.sock',
    },
  });
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  const createBothSpy = vi
    .spyOn(llamaStackManager as unknown as { CreateBoth: () => Promise<void> }, 'CreateBoth')
    .mockResolvedValue(undefined);

  await llamaStackManager.requestcreateLlamaStackContainerss({});

  expect(createBothSpy).toHaveBeenCalledWith(undefined, expect.any(Object), expect.anything());
});

test('onPodmanConnectionEvent start event should call refreshLlamaStackContainers and set containerInfo', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainers');
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(podmanConnection.onPodmanConnectionEvent).mockImplementation(f => {
    f({
      status: 'started',
    });
    return NO_OP_DISPOSABLE;
  });

  llamaStackManager.init();

  expect(llamaStackManager.refreshLlamaStackContainers).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainersInfo()).toEqual({
      server: { containerId: 'dummyId', port: 50000, state: 'running' },
      playground: undefined,
    });
  });
});

test('onPodmanConnectionEvent stop event should call refreshLlamaStackContainers and clear containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainers');
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(podmanConnection.onPodmanConnectionEvent).mockReturnValue(NO_OP_DISPOSABLE);

  llamaStackManager.init();
  const listener = vi.mocked(podmanConnection.onPodmanConnectionEvent).mock.calls[0][0];
  assert(listener, 'onPodmanConnectionEvent should have been called');

  listener({ status: 'started' });

  expect(llamaStackManager.refreshLlamaStackContainers).toHaveBeenCalledWith();
  await vi.waitFor(() => {
    expect(llamaStackManager.getContainersInfo()).toEqual({
      server: { containerId: 'dummyId', port: 50000, state: 'running' },
      playground: undefined,
    });
  });

  vi.mocked(llamaStackManager.refreshLlamaStackContainers).mockClear();
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_STOPPED]);

  listener({ status: 'stopped' });

  expect(llamaStackManager.refreshLlamaStackContainers).toHaveBeenCalledWith();
  await vi.waitFor(async () => {
    expect(llamaStackManager.getContainersInfo()).toEqual({ server: undefined, playground: undefined });
  });
});

test('onStartContainerEvent event should call refreshLlamaStackContainers and set containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainers');
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_RUNNING]);
  vi.mocked(containerRegistry.onStartContainerEvent).mockImplementation(f => {
    f({
      id: 'dummyId',
    });
    return NO_OP_DISPOSABLE;
  });

  llamaStackManager.init();

  expect(llamaStackManager.refreshLlamaStackContainers).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainersInfo()).toEqual({
      server: { containerId: 'dummyId', port: 50000, state: 'running' },
      playground: undefined,
    });
  });
});

test('onStopContainerEvent event should call refreshLlamaStackContainers and clear containerInfo', async () => {
  vi.spyOn(llamaStackManager, 'refreshLlamaStackContainers');
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

  expect(llamaStackManager.refreshLlamaStackContainers).toHaveBeenCalledWith();

  await vi.waitFor(() => {
    expect(llamaStackManager.getContainersInfo()).toEqual({
      server: { containerId: 'dummyId', port: 50000, state: 'running' },
      playground: undefined,
    });
  });

  vi.mocked(llamaStackManager.refreshLlamaStackContainers).mockClear();
  vi.mocked(containerEngine.listContainers).mockResolvedValueOnce([LLAMA_STACK_CONTAINER_STOPPED]);

  const listener = vi.mocked(containerRegistry.onStopContainerEvent).mock.calls[0][0];
  assert(listener, 'onStopContainerEvent should have been called');

  listener({ id: 'dummyId' });

  expect(taskRegistry.deleteByLabels).toHaveBeenCalled();
  await vi.waitFor(async () => {
    expect(llamaStackManager.getContainersInfo()).toBeUndefined();
  });
});
