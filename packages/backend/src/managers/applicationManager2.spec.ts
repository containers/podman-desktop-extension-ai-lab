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
import type { PodInfo, TelemetryLogger, Webview } from '@podman-desktop/api';
import type {
  PodmanConnection,
  machineStopHandle,
  podRemoveHandle,
  podStartHandle,
  podStopHandle,
  startupHandle,
} from './podmanConnection';
import { ApplicationManager } from './applicationManager';
import type { CatalogManager } from './catalogManager';
import type { ModelsManager } from './modelsManager';
import type { GitManager } from './gitManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';

let manager: ApplicationManager;

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
  getStatus: vi.fn(),
  getStatuses: vi.fn(),
  setStatus: vi.fn(),
  setStateAllRecipes: vi.fn(),
  deleteStatus: vi.fn(),
  setRecipeState: vi.fn(),
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

  manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as GitManager,
    {
      getStatus: mocks.getStatus,
      getStatuses: mocks.getStatuses,
      setStatus: mocks.setStatus,
      setStateAllRecipes: mocks.setStateAllRecipes,
      deleteStatus: mocks.deleteStatus,
      setRecipeState: mocks.setRecipeState,
    } as unknown as RecipeStatusRegistry,
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
    {} as CatalogManager,
    {} as ModelsManager,
    {} as TelemetryLogger,
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
  // no status for the environment yet
  mocks.getStatus.mockReturnValue(false);
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(mocks.setStatus).toHaveBeenNthCalledWith(1, 'recipe-id-1', {
    pod: {
      Labels: {
        'ai-studio-recipe-id': 'recipe-id-1',
      },
    },
    recipeId: 'recipe-id-1',
    state: 'running',
    tasks: [],
  });
});

test('adoptRunningEnvironments does not update the environment state with the found pod without label', async () => {
  mocks.listPods.mockResolvedValue([{}]);
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  // no status for the environment yet
  mocks.getStatus.mockReturnValue(false);
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(mocks.setStatus).not.toHaveBeenCalled();
});

test('onMachineStop updates the environments state with no environment running', async () => {
  mocks.listPods.mockResolvedValue([]);
  mocks.onMachineStop.mockImplementation((f: machineStopHandle) => {
    f();
  });
  manager.adoptRunningEnvironments();
  expect(mocks.setStateAllRecipes).toHaveBeenCalledOnce();
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
  manager.adoptRunningEnvironments();
  expect(mocks.setStatus).toHaveBeenCalledOnce();
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
  manager.adoptRunningEnvironments();
  expect(mocks.setStatus).not.toHaveBeenCalledOnce();
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
  mocks.getStatus.mockReturnValueOnce(false).mockReturnValueOnce(true);
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(mocks.setStatus).toHaveBeenCalledTimes(1);
  expect(mocks.deleteStatus).toHaveBeenCalledTimes(1);
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
  mocks.getStatuses.mockReturnValue([
    {
      pod: {
        Id: 'pod-id-1',
        Labels: {
          'ai-studio-recipe-id': 'recipe-id-1',
        },
      },
    },
  ]);
  mocks.getStatus.mockReturnValueOnce(false).mockReturnValueOnce(true);
  manager.adoptRunningEnvironments();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(mocks.setStatus).toHaveBeenCalledTimes(1);
  expect(mocks.deleteStatus).toHaveBeenCalledTimes(1);
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
  await manager.deleteEnvironment('recipe-id-1');
  expect(mocks.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.setRecipeState).toHaveBeenNthCalledWith(1, 'recipe-id-1', 'stopping');
  expect(mocks.setRecipeState).toHaveBeenNthCalledWith(2, 'recipe-id-1', 'removing');
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
  mocks.stopPod.mockRejectedValue('something went wrong, pod already stopped...');
  await manager.deleteEnvironment('recipe-id-1');
  expect(mocks.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  expect(mocks.setRecipeState).toHaveBeenNthCalledWith(1, 'recipe-id-1', 'stopping');
  expect(mocks.setRecipeState).toHaveBeenNthCalledWith(2, 'recipe-id-1', 'removing');
});
