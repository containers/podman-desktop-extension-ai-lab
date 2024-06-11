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
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { type ImageInfo, ApplicationManager, CONFIG_FILENAME } from './applicationManager';
import type { GitManager } from './gitManager';
import os from 'os';
import fs, { type PathLike } from 'node:fs';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { ModelsManager } from './modelsManager';
import path from 'node:path';
import type { AIConfig, ContainerConfig } from '../models/AIConfig';
import * as portsUtils from '../utils/ports';
import { goarch } from '../utils/arch';
import * as utils from '../utils/utils';
import * as podman from '../utils/podman';
import type { Webview, TelemetryLogger, PodInfo, Disposable } from '@podman-desktop/api';
import type { CatalogManager } from './catalogManager';
import type { LocalRepositoryRegistry } from '../registries/LocalRepositoryRegistry';
import type { PodmanConnection, machineStopHandle, startupHandle } from './podmanConnection';
import { TaskRegistry } from '../registries/TaskRegistry';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import type { BuilderManager } from './recipes/BuilderManager';
import type { PodEvent, PodManager } from './recipes/PodManager';

const mocks = vi.hoisted(() => {
  return {
    parseYamlFileMock: vi.fn(),
    listImagesMock: vi.fn(),
    getImageInspectMock: vi.fn(),
    createContainerMock: vi.fn(),
    startContainerMock: vi.fn(),
    inspectContainerMock: vi.fn(),
    logUsageMock: vi.fn(),
    logErrorMock: vi.fn(),
    registerLocalRepositoryMock: vi.fn(),
    postMessageMock: vi.fn(),
    getContainerConnectionsMock: vi.fn(),
    pullImageMock: vi.fn(),
    stopContainerMock: vi.fn(),
    containerRegistrySubscribeMock: vi.fn(),
    startupSubscribeMock: vi.fn(),
    onMachineStopMock: vi.fn(),
    listContainersMock: vi.fn(),
    performDownloadMock: vi.fn(),
    getTargetMock: vi.fn(),
    onEventDownloadMock: vi.fn(),
    // TaskRegistry
    getTaskMock: vi.fn(),
    createTaskMock: vi.fn(),
    updateTaskMock: vi.fn(),
    deleteMock: vi.fn(),
    deleteAllMock: vi.fn(),
    getTasksMock: vi.fn(),
    getTasksByLabelsMock: vi.fn(),
    deleteByLabelsMock: vi.fn(),
  };
});
vi.mock('../models/AIConfig', () => ({
  parseYamlFile: mocks.parseYamlFileMock,
}));

vi.mock('../utils/downloader', () => ({
  Downloader: class {
    onEvent = mocks.onEventDownloadMock;
    perform = mocks.performDownloadMock;
    getTarget = mocks.getTargetMock;
  },
}));

vi.mock('@podman-desktop/api', () => ({
  provider: {
    getContainerConnections: mocks.getContainerConnectionsMock,
  },
  containerEngine: {
    listImages: mocks.listImagesMock,
    getImageInspect: mocks.getImageInspectMock,
    createContainer: mocks.createContainerMock,
    startContainer: mocks.startContainerMock,
    inspectContainer: mocks.inspectContainerMock,
    pullImage: mocks.pullImageMock,
    stopContainer: mocks.stopContainerMock,
    listContainers: mocks.listContainersMock,
  },
  Disposable: {
    create: vi.fn(),
  },
}));

const telemetryLogger = {
  logUsage: mocks.logUsageMock,
  logError: mocks.logErrorMock,
} as unknown as TelemetryLogger;

const taskRegistry = {
  getTask: mocks.getTaskMock,
  createTask: mocks.createTaskMock,
  updateTask: mocks.updateTaskMock,
  delete: mocks.deleteMock,
  deleteAll: mocks.deleteAllMock,
  getTasks: mocks.getTasksMock,
  getTasksByLabels: mocks.getTasksByLabelsMock,
  deleteByLabels: mocks.deleteByLabelsMock,
} as unknown as TaskRegistry;

const builderManager = {
  build: vi.fn(),
} as unknown as BuilderManager;

const podManager = {
  getAllPods: vi.fn(),
  findPodByLabelsValues: vi.fn(),
  getPodsWithLabels: vi.fn(),
  getHealth: vi.fn(),
  getPod: vi.fn(),
  createPod: vi.fn(),
  stopPod: vi.fn(),
  removePod: vi.fn(),
  startPod: vi.fn(),
  onStartPodEvent: vi.fn(),
  onStopPodEvent: vi.fn(),
  onRemovePodEvent: vi.fn(),
} as unknown as PodManager;

const localRepositoryRegistry = {
  register: mocks.registerLocalRepositoryMock,
} as unknown as LocalRepositoryRegistry;

beforeEach(() => {
  vi.resetAllMocks();

  mocks.createTaskMock.mockImplementation((name, state, labels) => ({
    id: 'random',
    name: name,
    state: state,
    labels: labels ?? {},
    error: undefined,
  }));
});

describe('pullApplication', () => {
  interface mockForPullApplicationOptions {
    recipeFolderExists: boolean;
  }
  const processCheckoutMock = vi.fn();
  let manager: ApplicationManager;
  let modelsManager: ModelsManager;
  vi.spyOn(utils, 'timeout').mockResolvedValue();

  function mockForPullApplication(options: mockForPullApplicationOptions) {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'existsSync').mockImplementation((path: PathLike) => {
      path = path.toString();
      if (path.endsWith('recipe1')) {
        return options.recipeFolderExists;
      } else if (path.endsWith('ai-lab.yaml')) {
        return true;
      } else if (path.endsWith('contextdir1')) {
        return true;
      }
      return false;
    });
    vi.spyOn(fs, 'statSync').mockImplementation((path: PathLike) => {
      path = path.toString();
      if (path.endsWith('recipe1')) {
        const stat = new fs.Stats();
        stat.isDirectory = () => true;
        return stat;
      } else if (path.endsWith('ai-lab.yaml')) {
        const stat = new fs.Stats();
        stat.isDirectory = () => false;
        return stat;
      }
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      return '';
    });
    mocks.parseYamlFileMock.mockReturnValue({
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: 'contextdir1',
            containerfile: 'Containerfile',
            arch: [goarch()],
            gpu_env: [],
          },
        ],
      },
    });
    mocks.inspectContainerMock.mockResolvedValue({
      State: {
        Running: true,
      },
    });
    vi.mocked(builderManager.build).mockResolvedValue([
      {
        modelService: false,
        appName: 'dummy-app-name',
        ports: [],
        id: 'dummy-id',
      },
    ]);
    mocks.listImagesMock.mockResolvedValue([
      {
        RepoTags: ['recipe1-container1:latest'],
        engineId: 'engine',
        Id: 'id1',
      },
    ]);
    vi.mocked(podManager.createPod).mockResolvedValue({
      engineId: 'engine',
      Id: 'id',
    });
    mocks.createContainerMock.mockResolvedValue({
      id: 'id',
    });
    modelsManager = new ModelsManager(
      'appdir',
      {} as Webview,
      {
        getModels(): ModelInfo[] {
          return [];
        },
      } as CatalogManager,
      telemetryLogger,
      new TaskRegistry({ postMessage: vi.fn().mockResolvedValue(undefined) } as unknown as Webview),
      {
        createCancellationTokenSource: vi.fn(),
      } as unknown as CancellationTokenRegistry,
    );
    manager = new ApplicationManager(
      '/home/user/aistudio',
      {
        processCheckout: processCheckoutMock,
        isGitInstalled: () => true,
      } as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      modelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
  }
  test('pullApplication should clone repository and call downloadModelMain and buildImage', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
    mockForPullApplication({
      recipeFolderExists: false,
    });
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    vi.mocked(podManager.getPod).mockResolvedValue({
      engineId: 'dummyEngineId',
      Id: 'dummyPodId',
    } as unknown as PodInfo);
    vi.spyOn(podman, 'isQEMUMachine').mockResolvedValue(false);
    vi.spyOn(modelsManager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(modelsManager, 'uploadModelToPodmanMachine').mockResolvedValue('path');
    mocks.performDownloadMock.mockResolvedValue('path');
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
      description: '',
      ref: '000000',
      readme: '',
      repository: 'repo',
    };
    const model: ModelInfo = {
      id: 'model1',
      description: '',
      hw: '',
      license: '',
      name: 'Model 1',
      registry: '',
      url: 'dummy-url',
      memory: 1000,
    };
    mocks.inspectContainerMock.mockResolvedValue({
      State: {
        Running: true,
      },
    });
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);
    await manager.pullApplication(recipe, model);
    const gitCloneOptions = {
      repository: 'repo',
      ref: '000000',
      targetDirectory: '\\home\\user\\aistudio\\recipe1',
    };
    if (process.platform === 'win32') {
      expect(processCheckoutMock).toHaveBeenNthCalledWith(1, gitCloneOptions);
    } else {
      gitCloneOptions.targetDirectory = '/home/user/aistudio/recipe1';
      expect(processCheckoutMock).toHaveBeenNthCalledWith(1, gitCloneOptions);
    }
    expect(mocks.performDownloadMock).toHaveBeenCalledOnce();
    expect(builderManager.build).toHaveBeenCalledOnce();
    expect(builderManager.build).toHaveBeenCalledWith(
      {
        categories: [],
        description: '',
        id: 'recipe1',
        name: 'Recipe 1',
        readme: '',
        ref: '000000',
        repository: 'repo',
      },
      [
        {
          arch: ['amd64'],
          containerfile: 'Containerfile',
          contextdir: 'contextdir1',
          gpu_env: [],
          name: 'container1',
        },
      ],
      expect.anything(),
      {
        'model-id': 'model1',
        'recipe-id': 'recipe1',
      },
    );
    expect(mocks.logUsageMock).toHaveBeenNthCalledWith(1, 'recipe.pull', {
      'recipe.id': 'recipe1',
      'recipe.name': 'Recipe 1',
      durationSeconds: 99,
    });
  });
  test('pullApplication should clone repository and call downloadModelMain and fail on buildImage', async () => {
    mockForPullApplication({
      recipeFolderExists: false,
    });
    vi.mocked(builderManager.build).mockRejectedValue(new Error('Build failed'));
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    vi.spyOn(podman, 'isQEMUMachine').mockResolvedValue(false);
    vi.spyOn(modelsManager, 'isModelOnDisk').mockReturnValue(false);
    vi.spyOn(modelsManager, 'uploadModelToPodmanMachine').mockResolvedValue('path');
    mocks.performDownloadMock.mockResolvedValue('path');
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
      description: '',
      ref: '000000',
      readme: '',
      repository: 'repo',
    };
    const model: ModelInfo = {
      id: 'model1',
      description: '',
      hw: '',
      license: '',
      name: 'Model 1',
      registry: '',
      url: 'dummy-url',
      memory: 1000,
    };
    mocks.inspectContainerMock.mockResolvedValue({
      State: {
        Running: true,
      },
    });
    vi.spyOn(utils, 'getDurationSecondsSince').mockReturnValue(99);
    let error: unknown = undefined;
    try {
      await manager.pullApplication(recipe, model);
    } catch (err: unknown) {
      error = err;
    }
    expect(error).toBeDefined();
    const gitCloneOptions = {
      repository: 'repo',
      ref: '000000',
      targetDirectory: '\\home\\user\\aistudio\\recipe1',
    };
    if (process.platform === 'win32') {
      expect(processCheckoutMock).toHaveBeenNthCalledWith(1, gitCloneOptions);
    } else {
      gitCloneOptions.targetDirectory = '/home/user/aistudio/recipe1';
      expect(processCheckoutMock).toHaveBeenNthCalledWith(1, gitCloneOptions);
    }
    expect(mocks.performDownloadMock).toHaveBeenCalledOnce();
    expect(builderManager.build).toHaveBeenCalledOnce();
    expect(mocks.logErrorMock).toHaveBeenNthCalledWith(
      1,
      'recipe.pull',
      expect.objectContaining({
        'recipe.id': 'recipe1',
        'recipe.name': 'Recipe 1',
        durationSeconds: 99,
        message: 'error pulling application',
      }),
    );
  });
  test('pullApplication should not download model if already on disk', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
    mockForPullApplication({
      recipeFolderExists: true,
    });
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    vi.mocked(podManager.getPod).mockResolvedValue({
      engineId: 'dummyEngineId',
      Id: 'dummyPodId',
    } as unknown as PodInfo);
    vi.spyOn(modelsManager, 'isModelOnDisk').mockReturnValue(true);
    vi.spyOn(modelsManager, 'uploadModelToPodmanMachine').mockResolvedValue('path');
    vi.spyOn(modelsManager, 'getLocalModelPath').mockReturnValue('path');
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
      ref: '000000',
      description: '',
      readme: '',
      repository: 'repo',
    };
    const model: ModelInfo = {
      id: 'model1',
      description: '',
      hw: '',
      license: '',
      name: 'Model 1',
      registry: '',
      url: '',
      memory: 1000,
    };
    await manager.pullApplication(recipe, model);
    expect(mocks.performDownloadMock).not.toHaveBeenCalled();
  });

  test('pullApplication should mark the loading config as error if not container are found', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });

    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
      description: '',
      ref: '000000',
      readme: '',
      repository: 'repo',
    };
    const model: ModelInfo = {
      id: 'model1',
      description: '',
      hw: '',
      license: '',
      name: 'Model 1',
      registry: '',
      url: '',
      memory: 1000,
    };

    mocks.parseYamlFileMock.mockReturnValue({
      application: {
        containers: [],
      },
    });

    await expect(manager.pullApplication(recipe, model)).rejects.toThrowError('No containers available.');
    expect(mocks.performDownloadMock).not.toHaveBeenCalled();
  });
});

describe('getConfiguration', () => {
  test('throws error if config file do not exists', async () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      {} as unknown as ModelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => manager.getConfiguration('config', 'local')).toThrowError(
      `The file located at ${path.join('local', 'config', CONFIG_FILENAME)} does not exist.`,
    );
  });

  test('return AIConfigFile', async () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      {} as unknown as ModelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const stats = {
      isDirectory: vi.fn().mockReturnValue(false),
    } as unknown as fs.Stats;
    vi.spyOn(fs, 'statSync').mockReturnValue(stats);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    const aiConfig = {
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: 'contextdir1',
            containerfile: 'Containerfile',
          },
        ],
      },
    };
    mocks.parseYamlFileMock.mockReturnValue(aiConfig);

    const result = manager.getConfiguration('config', 'local');
    expect(result.path).toEqual(path.join('local', 'config', CONFIG_FILENAME));
    expect(result.aiConfig).toEqual(aiConfig);
  });
});

describe('filterContainers', () => {
  test('return empty array when no container fit the system', () => {
    const aiConfig: AIConfig = {
      application: {
        containers: [
          {
            name: 'container2',
            contextdir: 'contextdir2',
            containerfile: 'Containerfile',
            arch: ['arm64'],
            modelService: false,
            gpu_env: [],
          },
        ],
      },
    };
    Object.defineProperty(process, 'arch', {
      value: 'amd64',
    });
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      {} as unknown as ModelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
    const containers = manager.filterContainers(aiConfig);
    expect(containers.length).toBe(0);
  });
  test('return one container when only one fit the system', () => {
    const aiConfig: AIConfig = {
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: 'contextdir1',
            containerfile: 'Containerfile',
            arch: ['amd64'],
            modelService: false,
            gpu_env: [],
          },
          {
            name: 'container2',
            contextdir: 'contextdir2',
            containerfile: 'Containerfile',
            arch: ['arm64'],
            modelService: false,
            gpu_env: [],
          },
        ],
      },
    };
    Object.defineProperty(process, 'arch', {
      value: 'amd64',
    });
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      {} as unknown as ModelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
    const containers = manager.filterContainers(aiConfig);
    expect(containers.length).toBe(1);
    expect(containers[0].name).equal('container1');
  });
  test('return 2 containers when two fit the system', () => {
    const containerConfig: ContainerConfig[] = [
      {
        name: 'container1',
        contextdir: 'contextdir1',
        containerfile: 'Containerfile',
        arch: ['amd64'],
        modelService: false,
        gpu_env: [],
      },
      {
        name: 'container2',
        contextdir: 'contextdir2',
        containerfile: 'Containerfile',
        arch: ['arm64'],
        modelService: false,
        gpu_env: [],
      },
      {
        name: 'container3',
        contextdir: 'contextdir3',
        containerfile: 'Containerfile',
        arch: ['amd64'],
        modelService: false,
        gpu_env: [],
      },
    ];
    const aiConfig: AIConfig = {
      application: {
        containers: containerConfig,
      },
    };
    Object.defineProperty(process, 'arch', {
      value: 'amd64',
    });
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      taskRegistry,
      {} as Webview,
      {} as PodmanConnection,
      {} as CatalogManager,
      {} as unknown as ModelsManager,
      telemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
    const containers = manager.filterContainers(aiConfig);
    expect(containers.length).toBe(2);
    expect(containers[0].name).equal('container1');
    expect(containers[1].name).equal('container3');
  });
});

describe('createPod', async () => {
  const imageInfo1: ImageInfo = {
    id: 'id',
    appName: 'appName',
    modelService: false,
    ports: ['8080', '8081'],
  };
  const imageInfo2: ImageInfo = {
    id: 'id2',
    appName: 'appName2',
    modelService: true,
    ports: ['8082'],
  };
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    taskRegistry,
    {} as Webview,
    {} as PodmanConnection,
    {} as CatalogManager,
    {} as unknown as ModelsManager,
    telemetryLogger,
    localRepositoryRegistry,
    builderManager,
    podManager,
  );
  test('throw an error if there is no sample image', async () => {
    const images = [imageInfo2];
    await expect(
      manager.createPod({ id: 'recipe-id' } as Recipe, { id: 'model-id' } as ModelInfo, images),
    ).rejects.toThrowError('no sample app found');
  });
  test('call createPod with sample app exposed port', async () => {
    const images = [imageInfo1, imageInfo2];
    vi.spyOn(portsUtils, 'getPortsInfo').mockResolvedValueOnce('9000');
    vi.spyOn(portsUtils, 'getPortsInfo').mockResolvedValueOnce('9001');
    vi.spyOn(portsUtils, 'getPortsInfo').mockResolvedValueOnce('9002');
    vi.mocked(podManager.createPod).mockResolvedValue({
      Id: 'podId',
      engineId: 'engineId',
    });
    await manager.createPod({ id: 'recipe-id' } as Recipe, { id: 'model-id' } as ModelInfo, images);
    expect(podManager.createPod).toBeCalledWith({
      name: expect.anything(),
      portmappings: [
        {
          container_port: 8080,
          host_port: 9002,
          host_ip: '',
          protocol: '',
          range: 1,
        },
        {
          container_port: 8081,
          host_port: 9001,
          host_ip: '',
          protocol: '',
          range: 1,
        },
        {
          container_port: 8082,
          host_port: 9000,
          host_ip: '',
          protocol: '',
          range: 1,
        },
      ],
      labels: {
        'ai-lab-recipe-id': 'recipe-id',
        'ai-lab-app-ports': '9002,9001',
        'ai-lab-model-id': 'model-id',
        'ai-lab-model-ports': '9000',
      },
    });
  });
});

describe('createApplicationPod', () => {
  const imageInfo1: ImageInfo = {
    id: 'id',
    appName: 'appName',
    modelService: false,
    ports: ['8080', '8081'],
  };
  const imageInfo2: ImageInfo = {
    id: 'id2',
    appName: 'appName2',
    modelService: true,
    ports: ['8082'],
  };
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    taskRegistry,
    {} as Webview,
    {} as PodmanConnection,
    {} as CatalogManager,
    {} as unknown as ModelsManager,
    telemetryLogger,
    localRepositoryRegistry,
    builderManager,
    podManager,
  );
  const images = [imageInfo1, imageInfo2];
  test('throw if createPod fails', async () => {
    vi.spyOn(manager, 'createPod').mockRejectedValue('error createPod');
    await expect(
      manager.createApplicationPod({ id: 'recipe-id' } as Recipe, { id: 'model-id' } as ModelInfo, images, 'path'),
    ).rejects.toThrowError('error createPod');
    expect(mocks.updateTaskMock).toBeCalledWith({
      error: 'Something went wrong while creating pod: error createPod',
      id: expect.any(String),
      state: 'error',
      name: 'Creating AI App',
      labels: {},
    });
  });
  test('call createAndAddContainersToPod after pod is created', async () => {
    const pod: PodInfo = {
      engineId: 'engine',
      Id: 'id',
    } as unknown as PodInfo;
    vi.spyOn(manager, 'createPod').mockResolvedValue(pod);
    // mock createContainerAndAttachToPod
    const createAndAddContainersToPodMock = vi
      .spyOn(manager, 'createContainerAndAttachToPod')
      .mockResolvedValue(undefined);
    await manager.createApplicationPod({ id: 'recipe-id' } as Recipe, { id: 'model-id' } as ModelInfo, images, 'path');
    expect(createAndAddContainersToPodMock).toBeCalledWith(pod, images, { id: 'model-id' }, 'path');
    expect(mocks.updateTaskMock).toBeCalledWith({
      id: expect.any(String),
      state: 'success',
      name: 'Creating AI App',
      labels: {
        'pod-id': pod.Id,
      },
    });
  });
  test('throw if createAndAddContainersToPod fails', async () => {
    const pod: PodInfo = {
      engineId: 'engine',
      Id: 'id',
    } as unknown as PodInfo;
    vi.spyOn(manager, 'createPod').mockResolvedValue(pod);
    vi.spyOn(manager, 'createContainerAndAttachToPod').mockRejectedValue('error');
    await expect(() =>
      manager.createApplicationPod({ id: 'recipe-id' } as Recipe, { id: 'model-id' } as ModelInfo, images, 'path'),
    ).rejects.toThrowError('error');
    expect(mocks.updateTaskMock).toHaveBeenLastCalledWith({
      id: expect.any(String),
      state: 'error',
      error: 'Something went wrong while creating pod: error',
      name: 'Creating AI App',
      labels: {
        'pod-id': pod.Id,
      },
    });
  });
});

describe('runApplication', () => {
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    taskRegistry,
    {} as Webview,
    {} as PodmanConnection,
    {} as CatalogManager,
    {} as unknown as ModelsManager,
    telemetryLogger,
    localRepositoryRegistry,
    builderManager,
    podManager,
  );
  const pod: PodInfo = {
    engineId: 'engine',
    Id: 'id',
    Containers: [
      {
        Id: 'dummyContainerId',
      },
    ],
  } as unknown as PodInfo;
  test('check startPod is called and also waitContainerIsRunning for sample app', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
    const waitContainerIsRunningMock = vi.spyOn(manager, 'waitContainerIsRunning').mockResolvedValue(undefined);
    vi.spyOn(utils, 'timeout').mockResolvedValue();
    await manager.runApplication(pod);
    expect(podManager.startPod).toBeCalledWith(pod.engineId, pod.Id);
    expect(waitContainerIsRunningMock).toBeCalledWith(pod.engineId, {
      Id: 'dummyContainerId',
    });
  });
});

describe('createAndAddContainersToPod', () => {
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    taskRegistry,
    {} as Webview,
    {} as PodmanConnection,
    {} as CatalogManager,
    {} as unknown as ModelsManager,
    telemetryLogger,
    localRepositoryRegistry,
    builderManager,
    podManager,
  );
  const pod: PodInfo = {
    engineId: 'engine',
    Id: 'id',
    portmappings: [],
  } as unknown as PodInfo;
  const imageInfo1: ImageInfo = {
    id: 'id',
    appName: 'appName',
    modelService: false,
    ports: ['8080', '8081'],
  };
  const imageInfo2: ImageInfo = {
    id: 'id2',
    appName: 'appName2',
    modelService: true,
    ports: ['8085'],
  };
  async function checkContainers(modelInfo: ModelInfo, extraEnvs: string[]) {
    mocks.createContainerMock.mockResolvedValue({
      id: 'container-1',
    });
    vi.spyOn(podman, 'isQEMUMachine').mockResolvedValue(false);
    await manager.createContainerAndAttachToPod(pod, [imageInfo1, imageInfo2], modelInfo, 'path');
    expect(mocks.createContainerMock).toHaveBeenNthCalledWith(1, 'engine', {
      Image: 'id',
      Detach: true,
      Env: ['MODEL_ENDPOINT=http://localhost:8085'],
      start: false,
      name: expect.anything(),
      pod: 'id',
      HealthCheck: {
        Interval: 5000000000,
        Retries: 20,
        Test: ['CMD-SHELL', 'curl -s localhost:8080 > /dev/null'],
        Timeout: 2000000000,
      },
    });
    expect(mocks.createContainerMock).toHaveBeenNthCalledWith(2, 'engine', {
      Image: 'id2',
      Detach: true,
      Env: ['MODEL_PATH=/path', ...extraEnvs],
      start: false,
      name: expect.anything(),
      pod: 'id',
      HostConfig: {
        Mounts: [
          {
            Mode: 'Z',
            Source: 'path',
            Target: '/path',
            Type: 'bind',
          },
        ],
      },
      HealthCheck: {
        Interval: 5000000000,
        Retries: 20,
        Test: ['CMD-SHELL', 'curl -s localhost:8085 > /dev/null'],
        Timeout: 2000000000,
      },
    });
  }

  test('check that containers are correctly created with no model properties', async () => {
    await checkContainers({} as ModelInfo, []);
  });

  test('check that containers are correctly created with model properties', async () => {
    await checkContainers(
      {
        properties: {
          modelName: 'myModel',
        },
      } as unknown as ModelInfo,
      ['MODEL_MODEL_NAME=myModel'],
    );
  });
});

describe('pod detection', async () => {
  let manager: ApplicationManager;

  beforeEach(() => {
    vi.resetAllMocks();

    mocks.createTaskMock.mockImplementation((name, state, labels) => ({
      id: 'random',
      name: name,
      state: state,
      labels: labels ?? {},
      error: undefined,
    }));

    manager = new ApplicationManager(
      '/path/to/user/dir',
      {} as GitManager,
      taskRegistry,
      {
        postMessage: mocks.postMessageMock,
      } as unknown as Webview,
      {
        startupSubscribe: mocks.startupSubscribeMock,
        onMachineStop: mocks.onMachineStopMock,
      } as unknown as PodmanConnection,
      {
        getRecipeById: vi.fn().mockReturnValue({ name: 'MyRecipe' } as Recipe),
      } as unknown as CatalogManager,
      {} as ModelsManager,
      {} as TelemetryLogger,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );
  });

  test('init updates the app state with the found pod', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([
      {
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
          'ai-lab-app-ports': '5000,5001',
          'ai-lab-model-ports': '8000,8001',
        },
      } as unknown as PodInfo,
    ]);
    mocks.startupSubscribeMock.mockImplementation((f: startupHandle) => {
      f();
    });
    const updateApplicationStateSpy = vi.spyOn(manager, 'updateApplicationState');
    manager.init();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updateApplicationStateSpy).toHaveBeenNthCalledWith(1, 'recipe-id-1', 'model-id-1', {
      pod: {
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
          'ai-lab-app-ports': '5000,5001',
          'ai-lab-model-ports': '8000,8001',
        },
      },
      recipeId: 'recipe-id-1',
      modelId: 'model-id-1',
      appPorts: [5000, 5001],
      modelPorts: [8000, 8001],
      health: 'starting',
    });
    const ports = await manager.getApplicationPorts('recipe-id-1', 'model-id-1');
    expect(ports).toStrictEqual([5000, 5001]);
  });

  test('init does not update the application state with the found pod without label', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([{} as unknown as PodInfo]);
    mocks.startupSubscribeMock.mockImplementation((f: startupHandle) => {
      f();
    });
    const updateApplicationStateSpy = vi.spyOn(manager, 'updateApplicationState');
    manager.init();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updateApplicationStateSpy).not.toHaveBeenCalled();
  });

  test('onMachineStop updates the applications state with no application running', async () => {
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    mocks.onMachineStopMock.mockImplementation((f: machineStopHandle) => {
      f();
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    expect(sendApplicationStateSpy).toHaveBeenCalledOnce();
  });

  test('onPodStart updates the applications state with the started pod', async () => {
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    mocks.onMachineStopMock.mockImplementation((_f: machineStopHandle) => {});
    vi.mocked(podManager.onStartPodEvent).mockImplementation((f: (e: PodInfo) => void): Disposable => {
      f({
        engineId: 'engine-1',
        engineName: 'Engine 1',
        kind: 'podman',
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
        },
      } as unknown as PodInfo);
      return { dispose: vi.fn() };
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    expect(sendApplicationStateSpy).toHaveBeenCalledOnce();
  });

  test('onPodStart does no update the applications state with the started pod without labels', async () => {
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    mocks.onMachineStopMock.mockImplementation((_f: machineStopHandle) => {});
    vi.mocked(podManager.onStartPodEvent).mockImplementation((f: (e: PodInfo) => void): Disposable => {
      f({
        engineId: 'engine-1',
        engineName: 'Engine 1',
        kind: 'podman',
      } as unknown as PodInfo);
      return { dispose: vi.fn() };
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    expect(sendApplicationStateSpy).not.toHaveBeenCalledOnce();
  });

  test('onPodStart does no update the applications state with the started pod without specific labels', async () => {
    vi.mocked(podManager.getAllPods).mockResolvedValue([]);
    mocks.onMachineStopMock.mockImplementation((_f: machineStopHandle) => {});
    vi.mocked(podManager.onStartPodEvent).mockImplementation((f: (e: PodInfo) => void): Disposable => {
      f({
        engineId: 'engine-1',
        engineName: 'Engine 1',
        kind: 'podman',
        Labels: {
          label1: 'value1',
        },
      } as unknown as PodInfo);
      return { dispose: vi.fn() };
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    expect(sendApplicationStateSpy).not.toHaveBeenCalledOnce();
  });

  test('onPodStop updates the applications state by removing the stopped pod', async () => {
    mocks.startupSubscribeMock.mockImplementation((f: startupHandle) => {
      f();
    });
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([
      {
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
        },
      } as unknown as PodInfo,
    ]);
    mocks.onMachineStopMock.mockImplementation((_f: machineStopHandle) => {});
    vi.mocked(podManager.onStopPodEvent).mockImplementation((f: (e: PodInfo) => void): Disposable => {
      setTimeout(() => {
        f({
          engineId: 'engine-1',
          engineName: 'Engine 1',
          kind: 'podman',
          Labels: {
            'ai-lab-recipe-id': 'recipe-id-1',
            'ai-lab-model-id': 'model-id-1',
          },
        } as unknown as PodInfo);
        return { dispose: vi.fn() };
      }, 1);
      return { dispose: vi.fn() };
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sendApplicationStateSpy).toHaveBeenCalledTimes(1);
  });

  test('onPodRemove updates the applications state by removing the removed pod', async () => {
    mocks.startupSubscribeMock.mockImplementation((f: startupHandle) => {
      f();
    });
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([
      {
        Id: 'pod-id-1',
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
        },
      } as unknown as PodInfo,
    ]);
    mocks.onMachineStopMock.mockImplementation((_f: machineStopHandle) => {});
    vi.mocked(podManager.onRemovePodEvent).mockImplementation((f: (e: PodEvent) => void): Disposable => {
      setTimeout(() => {
        f({
          podId: 'pod-id-1',
        });
      }, 1);
      return { dispose: vi.fn() };
    });
    const sendApplicationStateSpy = vi.spyOn(manager, 'notify').mockResolvedValue();
    manager.init();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sendApplicationStateSpy).toHaveBeenCalledTimes(2);
  });

  test('getApplicationPod', async () => {
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      Labels: {
        'ai-lab-recipe-id': 'recipe-id-1',
        'ai-lab-model-id': 'model-id-1',
      },
    } as unknown as PodInfo);
    const result = await manager.getApplicationPod('recipe-id-1', 'model-id-1');
    expect(result).toEqual({
      Labels: {
        'ai-lab-recipe-id': 'recipe-id-1',
        'ai-lab-model-id': 'model-id-1',
      },
    });
    expect(podManager.findPodByLabelsValues).toHaveBeenCalledWith({
      'ai-lab-recipe-id': 'recipe-id-1',
      'ai-lab-model-id': 'model-id-1',
    });
  });

  test('removeApplication calls stopPod and removePod', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'engine-1',
      Id: 'pod-1',
      Labels: {
        'ai-lab-recipe-id': 'recipe-id-1',
        'ai-lab-model-id': 'model-id-1',
      },
    } as unknown as PodInfo);
    await manager.removeApplication('recipe-id-1', 'model-id-1');
    expect(podManager.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
    expect(podManager.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  });

  test('removeApplication calls stopPod and removePod even if stopPod fails because pod already stopped', async () => {
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([]);
    vi.mocked(podManager.findPodByLabelsValues).mockResolvedValue({
      engineId: 'engine-1',
      Id: 'pod-1',
      Labels: {
        'ai-lab-recipe-id': 'recipe-id-1',
        'ai-lab-model-id': 'model-id-1',
      },
    } as unknown as PodInfo);
    vi.mocked(podManager.stopPod).mockRejectedValue('something went wrong, pod already stopped...');
    await manager.removeApplication('recipe-id-1', 'model-id-1');
    expect(podManager.stopPod).toHaveBeenCalledWith('engine-1', 'pod-1');
    expect(podManager.removePod).toHaveBeenCalledWith('engine-1', 'pod-1');
  });

  test('init should check pods health', async () => {
    vi.mocked(podManager.getHealth).mockResolvedValue('healthy');
    vi.mocked(podManager.getPodsWithLabels).mockResolvedValue([
      {
        Id: 'pod1',
        engineId: 'engine1',
        Labels: {
          'ai-lab-recipe-id': 'recipe-id-1',
          'ai-lab-model-id': 'model-id-1',
          'ai-lab-app-ports': '5000,5001',
          'ai-lab-model-ports': '8000,8001',
        },
        Containers: [
          {
            Id: 'container1',
          },
          {
            Id: 'container2',
          },
          {
            Id: 'container3',
          },
        ],
      } as unknown as PodInfo,
    ]);
    mocks.startupSubscribeMock.mockImplementation((f: startupHandle) => {
      f();
    });
    vi.useFakeTimers();
    manager.init();
    await vi.advanceTimersByTimeAsync(1100);
    const state = manager.getApplicationsState();
    expect(state).toHaveLength(1);
    expect(state[0].health).toEqual('healthy');

    expect(podManager.getHealth).toHaveBeenCalledWith({
      Id: 'pod1',
      engineId: 'engine1',
      Labels: expect.anything(),
      Containers: expect.anything(),
    });
  });
});
