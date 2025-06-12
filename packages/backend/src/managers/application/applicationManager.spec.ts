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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { ContainerProviderConnection, PodInfo, TelemetryLogger } from '@podman-desktop/api';
import { containerEngine, window } from '@podman-desktop/api';
import type { PodmanConnection } from '../podmanConnection';
import type { CatalogManager } from '../catalogManager';
import type { ModelsManager } from '../modelsManager';
import type { PodManager } from '../recipes/PodManager';
import type { RecipeManager } from '../recipes/RecipeManager';
import { ApplicationManager } from './applicationManager';
import type { Recipe, RecipeImage } from '@shared/models/IRecipe';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { VMType } from '@shared/models/IPodman';
import { POD_LABEL_MODEL_ID, POD_LABEL_RECIPE_ID } from '../../utils/RecipeConstants';
import type { InferenceServer } from '@shared/models/IInference';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import type { ApplicationOptions } from '../../models/ApplicationOptions';

const taskRegistryMock = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteByLabels: vi.fn(),
} as unknown as TaskRegistry;

const rpcExtensionMock = {
  fire: vi.fn(),
} as unknown as RpcExtension;

const podmanConnectionMock = {
  onPodmanConnectionEvent: vi.fn(),
} as unknown as PodmanConnection;

const catalogManagerMock = {} as unknown as CatalogManager;

const modelsManagerMock = {
  requestDownloadModel: vi.fn(),
  uploadModelToPodmanMachine: vi.fn(),
} as unknown as ModelsManager;

const telemetryMock = {
  logError: vi.fn(),
  logUsage: vi.fn(),
} as unknown as TelemetryLogger;

const podManager = {
  onStartPodEvent: vi.fn(),
  onRemovePodEvent: vi.fn(),
  getPodsWithLabels: vi.fn(),
  createPod: vi.fn(),
  getPod: vi.fn(),
  findPodByLabelsValues: vi.fn(),
  startPod: vi.fn(),
  stopPod: vi.fn(),
  removePod: vi.fn(),
} as unknown as PodManager;

const recipeManager = {
  cloneRecipe: vi.fn(),
  buildRecipe: vi.fn(),
} as unknown as RecipeManager;

vi.mock('@podman-desktop/api', () => ({
  window: {
    withProgress: vi.fn(),
  },
  ProgressLocation: {
    TASK_WIDGET: 'task-widget',
  },
  provider: {
    getContainerConnections: vi.fn(),
  },
  containerEngine: {
    createContainer: vi.fn(),
  },
  Disposable: {
    create: vi.fn(),
  },
}));

const recipeMock: Recipe = {
  id: 'recipe-test',
  name: 'Test Recipe',
  categories: [],
  description: 'test recipe description',
  repository: 'http://test-repository.test',
  readme: 'test recipe readme',
};

const remoteModelMock: ModelInfo = {
  id: 'model-test',
  name: 'Test Model',
  description: 'test model description',
  url: 'http://test-repository.test',
};

const recipeImageInfoMock: RecipeImage = {
  name: 'test recipe image info',
  id: 'test-recipe-image-info',
  appName: 'test-app-name',
  engineId: 'test-engine-id',
  ports: [],
  modelService: false,
  recipeId: recipeMock.id,
};

const connectionMock: ContainerProviderConnection = {
  name: 'Podman Machine',
  vmType: VMType.UNKNOWN,
} as unknown as ContainerProviderConnection;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(rpcExtensionMock.fire).mockResolvedValue(true);
  vi.mocked(recipeManager.buildRecipe).mockResolvedValue({ images: [recipeImageInfoMock] });
  vi.mocked(podManager.createPod).mockResolvedValue({ engineId: 'test-engine-id', Id: 'test-pod-id' });
  vi.mocked(podManager.getPod).mockResolvedValue({ engineId: 'test-engine-id', Id: 'test-pod-id' } as PodInfo);
  vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
  vi.mocked(taskRegistryMock.createTask).mockImplementation((name, state, labels) => ({
    name,
    state,
    labels,
    id: 'fake-task',
  }));
  vi.mocked(modelsManagerMock.uploadModelToPodmanMachine).mockResolvedValue('downloaded-model-path');
});

function getInitializedApplicationManager(): ApplicationManager {
  const manager = new ApplicationManager(
    taskRegistryMock,
    rpcExtensionMock,
    podmanConnectionMock,
    catalogManagerMock,
    modelsManagerMock,
    telemetryMock,
    podManager,
    recipeManager,
  );

  manager.init();
  return manager;
}

describe('requestPullApplication', () => {
  test('task should be set to error if pull application raise an error', async () => {
    vi.mocked(window.withProgress).mockRejectedValue(new Error('pull application error'));
    const trackingId = await getInitializedApplicationManager().requestPullApplication({
      connection: connectionMock,
      recipe: recipeMock,
      model: remoteModelMock,
    });

    // ensure the task is created
    await vi.waitFor(() => {
      expect(taskRegistryMock.createTask).toHaveBeenCalledWith(`Pulling ${recipeMock.name} recipe`, 'loading', {
        trackingId: trackingId,
        'recipe-pulling': recipeMock.id,
      });
    });

    // ensure the task is updated
    await vi.waitFor(() => {
      expect(taskRegistryMock.updateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'error',
        }),
      );
    });
  });
});

describe('stopApplication', () => {
  test('calling stop with exited pod should not create task', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
      Status: 'Exited',
    } as unknown as PodInfo);

    await getInitializedApplicationManager().stopApplication(recipeMock.id, remoteModelMock.id);

    expect(taskRegistryMock.createTask).not.toHaveBeenCalled();
    expect(podManager.stopPod).not.toHaveBeenCalled();
  });

  test('calling stop application with running pod should create stop task ', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
      Status: 'Running',
    } as unknown as PodInfo);

    await getInitializedApplicationManager().stopApplication(recipeMock.id, remoteModelMock.id);

    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Stopping AI App', 'loading', {
      'recipe-id': recipeMock.id,
      'model-id': remoteModelMock.id,
    });
    expect(podManager.stopPod).toHaveBeenCalledWith('test-engine-id', 'test-pod-id-existing');
  });

  test('error raised should make the task as failed', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
      Status: 'Running',
    } as unknown as PodInfo);

    vi.mocked(podManager.stopPod).mockRejectedValue(new Error('stop pod error'));

    await expect(() => {
      return getInitializedApplicationManager().stopApplication(recipeMock.id, remoteModelMock.id);
    }).rejects.toThrowError('stop pod error');

    expect(taskRegistryMock.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'error',
      }),
    );
  });
});

describe('startApplication', () => {
  test('expect startPod in podManager to be properly called', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
      Status: 'Exited',
    } as unknown as PodInfo);

    await getInitializedApplicationManager().startApplication(recipeMock.id, remoteModelMock.id);

    expect(podManager.startPod).toHaveBeenCalledWith('test-engine-id', 'test-pod-id-existing');
  });

  test('error raised should make the task as failed', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
      Status: 'Exited',
    } as unknown as PodInfo);

    vi.mocked(podManager.startPod).mockRejectedValue(new Error('start pod error'));

    await expect(() => {
      return getInitializedApplicationManager().startApplication(recipeMock.id, remoteModelMock.id);
    }).rejects.toThrowError('start pod error');

    expect(taskRegistryMock.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'error',
      }),
    );
  });
});

describe.each([true, false])('pullApplication, with model is %o', withModel => {
  let applicationOptions: ApplicationOptions;
  beforeEach(() => {
    applicationOptions = withModel
      ? {
          connection: connectionMock,
          recipe: recipeMock,
          model: remoteModelMock,
        }
      : {
          connection: connectionMock,
          recipe: recipeMock,
        };
  });

  test('labels should be propagated', async () => {
    await getInitializedApplicationManager().pullApplication(applicationOptions, {
      'test-label': 'test-value',
    });

    // clone the recipe
    expect(recipeManager.cloneRecipe).toHaveBeenCalledWith(recipeMock, {
      'test-label': 'test-value',
      'model-id': withModel ? remoteModelMock.id : '<none>',
    });
    if (withModel) {
      // download model
      expect(modelsManagerMock.requestDownloadModel).toHaveBeenCalledWith(remoteModelMock, {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
        'model-id': remoteModelMock.id,
      });
      // upload model to podman machine
      expect(modelsManagerMock.uploadModelToPodmanMachine).toHaveBeenCalledWith(connectionMock, remoteModelMock, {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
        'model-id': remoteModelMock.id,
      });
    }
    // build the recipe
    expect(recipeManager.buildRecipe).toHaveBeenCalledWith(
      {
        connection: connectionMock,
        recipe: recipeMock,
        model: withModel ? remoteModelMock : undefined,
      },
      {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
        'model-id': withModel ? remoteModelMock.id : '<none>',
      },
    );
    // create AI App task must be created
    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Creating AI App', 'loading', {
      'test-label': 'test-value',
      'recipe-id': recipeMock.id,
      'model-id': withModel ? remoteModelMock.id : '<none>',
    });

    // a pod must have been created
    expect(podManager.createPod).toHaveBeenCalledWith({
      provider: connectionMock,
      name: expect.any(String),
      portmappings: [],
      labels: {
        [POD_LABEL_MODEL_ID]: withModel ? remoteModelMock.id : '<none>',
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith('test-engine-id', {
      Image: recipeImageInfoMock.id,
      name: expect.any(String),
      Env: [],
      HealthCheck: undefined,
      HostConfig: undefined,
      Detach: true,
      pod: 'test-pod-id',
      start: false,
    });

    // finally the pod must be started
    expect(podManager.startPod).toHaveBeenCalledWith('test-engine-id', 'test-pod-id');
  });

  test('requestDownloadModel skipped with inference server', async () => {
    vi.mocked(recipeManager.buildRecipe).mockResolvedValue({
      images: [recipeImageInfoMock],
      inferenceServer: {
        connection: {
          port: 56001,
        },
      } as InferenceServer,
    });
    vi.mocked(modelsManagerMock.requestDownloadModel).mockResolvedValue('/path/to/model');
    await getInitializedApplicationManager().pullApplication(applicationOptions, {
      'test-label': 'test-value',
    });

    // clone the recipe
    expect(recipeManager.cloneRecipe).toHaveBeenCalledWith(recipeMock, {
      'test-label': 'test-value',
      'model-id': withModel ? remoteModelMock.id : '<none>',
    });
    if (withModel) {
      // download model
      expect(modelsManagerMock.requestDownloadModel).toHaveBeenCalledWith(remoteModelMock, {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
        'model-id': remoteModelMock.id,
      });
      // upload model to podman machine
      expect(modelsManagerMock.uploadModelToPodmanMachine).not.toHaveBeenCalled();
    }
    // build the recipe
    expect(recipeManager.buildRecipe).toHaveBeenCalledWith(
      {
        connection: connectionMock,
        recipe: recipeMock,
        model: withModel ? remoteModelMock : undefined,
      },
      {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
        'model-id': withModel ? remoteModelMock.id : '<none>',
      },
    );
    // create AI App task must be created
    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Creating AI App', 'loading', {
      'test-label': 'test-value',
      'recipe-id': recipeMock.id,
      'model-id': withModel ? remoteModelMock.id : '<none>',
    });

    // a pod must have been created
    expect(podManager.createPod).toHaveBeenCalledWith({
      provider: connectionMock,
      name: expect.any(String),
      portmappings: [],
      labels: {
        [POD_LABEL_MODEL_ID]: withModel ? remoteModelMock.id : '<none>',
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith('test-engine-id', {
      Image: recipeImageInfoMock.id,
      name: expect.any(String),
      Env: withModel ? ['MODEL_ENDPOINT=http://host.containers.internal:56001'] : [],
      HealthCheck: undefined,
      HostConfig: undefined,
      Detach: true,
      pod: 'test-pod-id',
      start: false,
    });

    // finally the pod must be started
    expect(podManager.startPod).toHaveBeenCalledWith('test-engine-id', 'test-pod-id');
  });

  test('existing application should be removed', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'test-engine-id',
      Id: 'test-pod-id-existing',
      Labels: {
        [POD_LABEL_MODEL_ID]: remoteModelMock.id,
        [POD_LABEL_RECIPE_ID]: recipeMock.id,
      },
    } as unknown as PodInfo);

    await getInitializedApplicationManager().pullApplication(applicationOptions);

    // removing existing application should create a task to notify the user
    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Removing AI App', 'loading', {
      'recipe-id': recipeMock.id,
      'model-id': withModel ? remoteModelMock.id : '<none>',
    });
    // the remove pod should have been called
    expect(podManager.removePod).toHaveBeenCalledWith('test-engine-id', 'test-pod-id-existing');
  });

  test('qemu connection should have specific flag', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue(undefined);

    vi.mocked(recipeManager.buildRecipe).mockResolvedValue({
      images: [
        recipeImageInfoMock,
        {
          modelService: true,
          ports: ['8888'],
          name: 'llamacpp',
          id: 'llamacpp',
          appName: 'llamacpp',
          engineId: recipeImageInfoMock.engineId,
          recipeId: recipeMock.id,
        },
      ],
    });

    await getInitializedApplicationManager().pullApplication(applicationOptions);

    // the remove pod should have been called
    expect(containerEngine.createContainer).toHaveBeenCalledWith(
      recipeImageInfoMock.engineId,
      expect.objectContaining({
        HostConfig: withModel
          ? {
              Mounts: [
                {
                  Mode: 'Z',
                  Source: 'downloaded-model-path',
                  Target: '/downloaded-model-path',
                  Type: 'bind',
                },
              ],
            }
          : undefined,
      }),
    );
  });
});
