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

import { beforeEach, expect, test, vi } from 'vitest';
import { EnvironmentManager } from './environmentManager';
import type { PodInfo, Webview } from '@podman-desktop/api';
import type {
  PodmanConnection,
  machineStopHandle,
  podRemoveHandle,
  podStartHandle,
  podStopHandle,
  startupHandle,
} from './podmanConnection';
import { ApplicationManager } from './applicationManager';
import { CatalogManager } from './catalogManager';

let manager: EnvironmentManager;

const mocks = vi.hoisted(() => ({
  postMessage: vi.fn(),
  getContainerConnections: vi.fn(),
  pullImage: vi.fn(),
  createContainer: vi.fn(),
  stopContainer: vi.fn(),
  getFreePort: vi.fn(),
  containerRegistrySubscribeMock: vi.fn(),
  onPodStart: vi.fn(),
  onPodStop: vi.fn(),
  onPodRemove: vi.fn(),
  startupSubscribe: vi.fn(),
  onMachineStop: vi.fn(),
  listContainers: vi.fn(),
  listPods: vi.fn(),
  stopPod: vi.fn(),
  removePod: vi.fn(),
  logUsage: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    provider: {
      getContainerConnections: mocks.getContainerConnections,
    },
    containerEngine: {
      pullImage: mocks.pullImage,
      createContainer: mocks.createContainer,
      stopContainer: mocks.stopContainer,
      listContainers: mocks.listContainers,
      listPods: mocks.listPods,
      stopPod: mocks.stopPod,
      removePod: mocks.removePod,
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();

  manager = new EnvironmentManager(
    {
      postMessage: mocks.postMessage,
    } as unknown as Webview,
    {
      onPodStart: mocks.onPodStart,
      onPodStop: mocks.onPodStop,
      onPodRemove: mocks.onPodRemove,
      startupSubscribe: mocks.startupSubscribe,
      onMachineStop: mocks.onMachineStop,
    } as unknown as PodmanConnection,
    {} as ApplicationManager,
    {} as CatalogManager,
  );
});

test('adoptRunningEnvironments updates the environment state with the found pod', async () => {
  mocks.listPods.mockResolvedValue([
    {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
  ]);
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  const updateEnvironmentStateSpy = vi.spyOn(manager, 'updateEnvironmentState');
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(updateEnvironmentStateSpy).toHaveBeenNthCalledWith(1, 'recipe-id-1', {
    pod: {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
    recipeId: 'recipe-id-1',
    status: 'running',
  });
});

test('adoptRunningEnvironments does not update the environment state with the found pod without label', async () => {
  mocks.listPods.mockResolvedValue([{}]);
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  const updateEnvironmentStateSpy = vi.spyOn(manager, 'updateEnvironmentState');
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(updateEnvironmentStateSpy).not.toHaveBeenCalled();
});

test('onMachineStop updates the environments state with no environment running', async () => {
  mocks.listPods.mockResolvedValue([]);
  mocks.onMachineStop.mockImplementation((f: machineStopHandle) => {
    f();
  });
  const sendEnvironmentStateSpy = vi.spyOn(manager, 'sendEnvironmentState').mockResolvedValue();
  manager.adoptRunningEnvironments();
  expect(sendEnvironmentStateSpy).toHaveBeenCalledOnce();
});

test('onPodStart updates the environments state with the started pod', async () => {
  mocks.listPods.mockResolvedValue([]);
  mocks.onMachineStop.mockImplementation((_f: machineStopHandle) => {});
  mocks.onPodStart.mockImplementation((f: podStartHandle) => {
    f({
      engineId: 'engine-1',
      engineName: 'Engine 1',
      kind: 'podman',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    } as unknown as PodInfo);
  });
  const sendEnvironmentStateSpy = vi.spyOn(manager, 'sendEnvironmentState').mockResolvedValue();
  manager.adoptRunningEnvironments();
  expect(sendEnvironmentStateSpy).toHaveBeenCalledOnce();
});

test('onPodStart does no update the environments state with the started pod without labels', async () => {
  mocks.listPods.mockResolvedValue([]);
  mocks.onMachineStop.mockImplementation((_f: machineStopHandle) => {});
  mocks.onPodStart.mockImplementation((f: podStartHandle) => {
    f({
      engineId: 'engine-1',
      engineName: 'Engine 1',
      kind: 'podman',
    } as unknown as PodInfo);
  });
  const sendEnvironmentStateSpy = vi.spyOn(manager, 'sendEnvironmentState').mockResolvedValue();
  manager.adoptRunningEnvironments();
  expect(sendEnvironmentStateSpy).not.toHaveBeenCalledOnce();
});

test('onPodStop updates the environments state by removing the stopped pod', async () => {
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  mocks.listPods.mockResolvedValue([
    {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
  ]);
  mocks.onMachineStop.mockImplementation((_f: machineStopHandle) => {});
  mocks.onPodStop.mockImplementation((f: podStopHandle) => {
    setTimeout(() => {
      f({
        engineId: 'engine-1',
        engineName: 'Engine 1',
        kind: 'podman',
        Labels: {
          'ai-studio-recipe-id': 'recipe-id-1',
        },
      } as unknown as PodInfo);
    }, 1);
  });
  const sendEnvironmentStateSpy = vi.spyOn(manager, 'sendEnvironmentState').mockResolvedValue();
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(sendEnvironmentStateSpy).toHaveBeenCalledTimes(2);
});

test('onPodRemove updates the environments state by removing the removed pod', async () => {
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  mocks.listPods.mockResolvedValue([
    {
      Id: 'pod-id-1',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
  ]);
  mocks.onMachineStop.mockImplementation((_f: machineStopHandle) => {});
  mocks.onPodRemove.mockImplementation((f: podRemoveHandle) => {
    setTimeout(() => {
      f('pod-id-1');
    }, 1);
  });
  const sendEnvironmentStateSpy = vi.spyOn(manager, 'sendEnvironmentState').mockResolvedValue();
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(sendEnvironmentStateSpy).toHaveBeenCalledTimes(2);
});

test('getEnvironmentPod', async () => {
  mocks.listPods.mockResolvedValue([
    {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
    {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-2',
      },
    },
  ]);
  const result = await manager.getEnvironmentPod('recipe-id-1');
  expect(result).toEqual({
    Labels: {
      'ai-studio-recipe-id': 'recipe-id-1',
    },
  });
});

test('deleteEnvironment calls stopPod and removePod', async () => {
  mocks.listPods.mockResolvedValue([
    {
      engineId: 'engine-1',
      Id: 'pod-1',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
    {
      engineId: 'engine-2',
      Id: 'pod-2',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-2',
      },
    },
  ]);
  const setEnvironmentStatusSpy = vi.spyOn(manager, 'setEnvironmentStatus');
  setEnvironmentStatusSpy.mockReturnValue();
  await manager.deleteEnvironment('recipe-id-1');
  expect(mocks.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(setEnvironmentStatusSpy).toHaveBeenNthCalledWith(1, 'recipe-id-1', 'stopping');
  expect(setEnvironmentStatusSpy).toHaveBeenNthCalledWith(2, 'recipe-id-1', 'removing');
});

test('deleteEnvironment calls stopPod and removePod even if stopPod fails because pod already stopped', async () => {
  mocks.listPods.mockResolvedValue([
    {
      engineId: 'engine-1',
      Id: 'pod-1',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
    {
      engineId: 'engine-2',
      Id: 'pod-2',
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-2',
      },
    },
  ]);
  const setEnvironmentStatusSpy = vi.spyOn(manager, 'setEnvironmentStatus');
  setEnvironmentStatusSpy.mockReturnValue();
  mocks.stopPod.mockRejectedValue('something went wrong, pod already stopped...');
  await manager.deleteEnvironment('recipe-id-1');
  expect(mocks.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(setEnvironmentStatusSpy).toHaveBeenNthCalledWith(1, 'recipe-id-1', 'stopping');
  expect(setEnvironmentStatusSpy).toHaveBeenNthCalledWith(2, 'recipe-id-1', 'removing');
});
