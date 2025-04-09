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
import { TaskRegistry } from '../../registries/TaskRegistry';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { ContainerCreateResult, ContainerInfo, ImageInfo, TelemetryLogger } from '@podman-desktop/api';
import { containerEngine, EventEmitter } from '@podman-desktop/api';
import type { PodmanConnection } from '../podmanConnection';
import { ContainerRegistry } from '../../registries/ContainerRegistry';
import { TestEventEmitter } from '../../tests/utils';
import { VMType } from '@shared/models/IPodman';
import type { Task } from '@shared/models/ITask';
import llama_stack_images from '../../assets/llama-stack-images.json';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { LLAMA_STACK_API_PORT_LABEL, LLAMA_STACK_CONTAINER_LABEL, LlamaStackManager } from './llamaStackManager';
import { LLAMA_STACK_CONTAINER_TRACKINGID } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import type { ExtensionConfiguration } from '@shared/models/IExtensionConfiguration';

vi.mock('@podman-desktop/api', () => {
  return {
    EventEmitter: vi.fn(),
    containerEngine: {
      listContainers: vi.fn(),
      listImages: vi.fn(),
      createContainer: vi.fn(),
      onEvent: vi.fn(),
    },
  };
});

const taskRegistry = new TaskRegistry({ fire: vi.fn().mockResolvedValue(true) } as unknown as RpcExtension);

const podmanConnection: PodmanConnection = {
  onPodmanConnectionEvent: vi.fn(),
  findRunningContainerProviderConnection: vi.fn(),
} as unknown as PodmanConnection;

const configurationRegistry = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

let llamaStackManager: LlamaStackManager;

beforeAll(() => {
  vi.mocked(EventEmitter).mockImplementation(() => new TestEventEmitter() as unknown as EventEmitter<unknown>);
});

beforeEach(() => {
  const containerRegistry = new ContainerRegistry();
  containerRegistry.init();
  llamaStackManager = new LlamaStackManager(
    '',
    taskRegistry,
    podmanConnection,
    containerRegistry,
    configurationRegistry,
    telemetryMock,
  );
  taskRegistry.deleteByLabels({ trackingId: LLAMA_STACK_CONTAINER_TRACKINGID });
});

test('getLlamaStackContainer should return undefined if no containers', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([]);
  const containerId = await llamaStackManager.getLlamaStackContainer();
  expect(containerId).toBeUndefined();
});

test('getLlamaStackContainer should return undefined if no llama stack container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([{ Id: 'dummyId' } as unknown as ContainerInfo]);
  const containerId = await llamaStackManager.getLlamaStackContainer();
  expect(containerId).toBeUndefined();
});

test('getLlamaStackContainer should return id if instructlab container', async () => {
  vi.mocked(containerEngine.listContainers).mockResolvedValue([
    {
      Id: 'dummyId',
      State: 'running',
      Labels: {
        [LLAMA_STACK_CONTAINER_LABEL]: 'dummyLabel',
        [LLAMA_STACK_API_PORT_LABEL]: '50000',
      },
    } as unknown as ContainerInfo,
  ]);
  const containerInfo = await llamaStackManager.getLlamaStackContainer();
  expect(containerInfo).toEqual({ containerId: 'dummyId', port: 50000 });
});

test('requestCreateLlamaStackContainer throws error if no podman connection', async () => {
  const containerIdPromise = llamaStackManager.requestCreateLlamaStackContainer({});
  await expect(containerIdPromise).rejects.toBeInstanceOf(Error);
});

async function waitTasks(id: string, nb: number): Promise<Task[]> {
  return vi.waitFor(() => {
    const tasks = taskRegistry.getTasksByLabels({ trackingId: id });
    if (tasks.length !== nb) {
      throw new Error('not completed');
    }
    return tasks;
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
  await llamaStackManager.requestCreateLlamaStackContainer({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 3);
  expect(tasks.some(task => task.state === 'error')).toBeTruthy();
});

test('requestCreateLlamaStackContainer returns id and no error if createContainer returns id', async () => {
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
  await llamaStackManager.requestCreateLlamaStackContainer({});
  const tasks = await waitTasks(LLAMA_STACK_CONTAINER_TRACKINGID, 3);
  expect(tasks.some(task => task.state === 'error')).toBeFalsy();
});
