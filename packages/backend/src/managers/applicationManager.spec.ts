import { type MockInstance, describe, expect, test, vi, beforeEach } from 'vitest';
import type { ContainerAttachedInfo, DownloadModelResult, ImageInfo, PodInfo } from './applicationManager';
import { ApplicationManager } from './applicationManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { GitManager } from './gitManager';
import os from 'os';
import fs from 'node:fs';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { RecipeStatusUtils } from '../utils/recipeStatusUtils';
import type { ModelsManager } from './modelsManager';
import path from 'node:path';
import type { AIConfig, ContainerConfig } from '../models/AIConfig';
import * as portsUtils from '../utils/ports';
import { goarch } from '../utils/arch';
import * as utils from '../utils/utils';

const mocks = vi.hoisted(() => {
  return {
    parseYamlMock: vi.fn(),
    builImageMock: vi.fn(),
    listImagesMock: vi.fn(),
    getImageInspectMock: vi.fn(),
    createPodMock: vi.fn(),
    createContainerMock: vi.fn(),
    replicatePodmanContainerMock: vi.fn(),
    startContainerMock: vi.fn(),
    startPod: vi.fn(),
  };
});
vi.mock('../models/AIConfig', () => ({
  parseYaml: mocks.parseYamlMock,
}));
vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    buildImage: mocks.builImageMock,
    listImages: mocks.listImagesMock,
    getImageInspect: mocks.getImageInspectMock,
    createPod: mocks.createPodMock,
    createContainer: mocks.createContainerMock,
    replicatePodmanContainer: mocks.replicatePodmanContainerMock,
    startContainer: mocks.startContainerMock,
    startPod: mocks.startPod,
  },
}));
let setTaskMock: MockInstance;
let taskUtils: RecipeStatusUtils;
let setTaskStateMock: MockInstance;
beforeEach(() => {
  vi.resetAllMocks();
  taskUtils = new RecipeStatusUtils('recipe', {
    setStatus: vi.fn(),
  } as unknown as RecipeStatusRegistry);
  setTaskMock = vi.spyOn(taskUtils, 'setTask');
  setTaskStateMock = vi.spyOn(taskUtils, 'setTaskState');
});
describe('pullApplication', () => {
  interface mockForPullApplicationOptions {
    recipeFolderExists: boolean;
  }
  const setStatusMock = vi.fn();
  const cloneRepositoryMock = vi.fn();
  const isModelOnDiskMock = vi.fn();
  const getLocalModelPathMock = vi.fn();
  let manager: ApplicationManager;
  let doDownloadModelWrapperSpy: MockInstance<
    [modelId: string, url: string, taskUtil: RecipeStatusUtils, destFileName?: string],
    Promise<string>
  >;
  function mockForPullApplication(options: mockForPullApplicationOptions) {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'existsSync').mockImplementation((path: string) => {
      if (path.endsWith('recipe1')) {
        return options.recipeFolderExists;
      } else if (path.endsWith('ai-studio.yaml')) {
        return true;
      } else if (path.endsWith('contextdir1')) {
        return true;
      }
      return false;
    });
    vi.spyOn(fs, 'statSync').mockImplementation((path: string) => {
      if (path.endsWith('recipe1')) {
        const stat = new fs.Stats();
        stat.isDirectory = () => true;
        return stat;
      } else if (path.endsWith('ai-studio.yaml')) {
        const stat = new fs.Stats();
        stat.isDirectory = () => false;
        return stat;
      }
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((_path: string) => {
      return '';
    });
    mocks.parseYamlMock.mockReturnValue({
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
    mocks.builImageMock.mockResolvedValue(undefined);
    mocks.listImagesMock.mockResolvedValue([
      {
        RepoTags: ['container1:latest'],
        engineId: 'engine',
        Id: 'id1',
      },
    ]);
    mocks.getImageInspectMock.mockResolvedValue({
      Config: {
        ExposedPorts: {
          '8080': '8080',
        },
      },
    });
    mocks.createPodMock.mockResolvedValue({
      engineId: 'engine',
      Id: 'id',
    });
    mocks.createContainerMock.mockResolvedValue({
      id: 'id',
    });
    manager = new ApplicationManager(
      '/home/user/aistudio',
      {
        cloneRepository: cloneRepositoryMock,
      } as unknown as GitManager,
      {
        setStatus: setStatusMock,
      } as unknown as RecipeStatusRegistry,
      {
        isModelOnDisk: isModelOnDiskMock,
        getLocalModelPath: getLocalModelPathMock,
      } as unknown as ModelsManager,
    );
    doDownloadModelWrapperSpy = vi.spyOn(manager, 'doDownloadModelWrapper');
    doDownloadModelWrapperSpy.mockResolvedValue('path');
  }
  test('pullApplication should clone repository and call downloadModelMain and buildImage', async () => {
    mockForPullApplication({
      recipeFolderExists: false,
    });
    isModelOnDiskMock.mockReturnValue(false);
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
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
      popularity: 1,
      registry: '',
      url: '',
    };
    await manager.pullApplication(recipe, model);
    if (process.platform === 'win32') {
      expect(cloneRepositoryMock).toHaveBeenNthCalledWith(1, 'repo', '\\home\\user\\aistudio\\recipe1');
    } else {
      expect(cloneRepositoryMock).toHaveBeenNthCalledWith(1, 'repo', '/home/user/aistudio/recipe1');
    }
    expect(doDownloadModelWrapperSpy).toHaveBeenCalledOnce();
    expect(mocks.builImageMock).toHaveBeenCalledOnce();
  });
  test('pullApplication should not clone repository if folder already exists locally', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });
    isModelOnDiskMock.mockReturnValue(false);
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
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
      popularity: 1,
      registry: '',
      url: '',
    };
    await manager.pullApplication(recipe, model);
    expect(cloneRepositoryMock).not.toHaveBeenCalled();
  });
  test('pullApplication should not download model if already on disk', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });
    isModelOnDiskMock.mockReturnValue(true);
    getLocalModelPathMock.mockReturnValue('path');
    const recipe: Recipe = {
      id: 'recipe1',
      name: 'Recipe 1',
      categories: [],
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
      popularity: 1,
      registry: '',
      url: '',
    };
    await manager.pullApplication(recipe, model);
    expect(cloneRepositoryMock).not.toHaveBeenCalled();
    expect(doDownloadModelWrapperSpy).not.toHaveBeenCalled();
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
      readme: '',
      repository: 'repo',
    };
    const model: ModelInfo = {
      id: 'model1',
      description: '',
      hw: '',
      license: '',
      name: 'Model 1',
      popularity: 1,
      registry: '',
      url: '',
    };

    mocks.parseYamlMock.mockReturnValue({
      application: {
        containers: [],
      },
    });

    await expect(manager.pullApplication(recipe, model)).rejects.toThrowError('No containers available.');

    expect(cloneRepositoryMock).not.toHaveBeenCalled();
    expect(doDownloadModelWrapperSpy).not.toHaveBeenCalled();
  });
});
describe('doCheckout', () => {
  test('clone repo if not present locally', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync');
    const cloneRepositoryMock = vi.fn();
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {
        cloneRepository: cloneRepositoryMock,
      } as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    await manager.doCheckout('repo', 'folder', taskUtils);
    expect(cloneRepositoryMock).toBeCalledWith('repo', 'folder');
    expect(setTaskMock).toHaveBeenLastCalledWith({
      id: 'checkout',
      name: 'Checkout repository',
      state: 'success',
      labels: {
        git: 'checkout',
      },
    });
  });
  test('do not clone repo if already present locally', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const stats = {
      isDirectory: vi.fn().mockReturnValue(true),
    } as unknown as fs.Stats;
    vi.spyOn(fs, 'statSync').mockReturnValue(stats);
    const mkdirSyncMock = vi.spyOn(fs, 'mkdirSync');
    const cloneRepositoryMock = vi.fn();
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {
        cloneRepository: cloneRepositoryMock,
      } as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    await manager.doCheckout('repo', 'folder', taskUtils);
    expect(mkdirSyncMock).not.toHaveBeenCalled();
    expect(cloneRepositoryMock).not.toHaveBeenCalled();
    expect(setTaskMock).toHaveBeenLastCalledWith({
      id: 'checkout',
      name: 'Checkout repository (cached).',
      state: 'success',
      labels: {
        git: 'checkout',
      },
    });
  });
});

describe('getConfiguration', () => {
  test('throws error if config file do not exists', async () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => manager.getConfiguration('config', 'local')).toThrowError(
      `The file located at ${path.join('local', 'config')} does not exist.`,
    );
  });

  test('return AIConfigFile', async () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
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
    mocks.parseYamlMock.mockReturnValue(aiConfig);

    const result = manager.getConfiguration('config', 'local');
    expect(result.path).toEqual(path.join('local', 'config'));
    expect(result.aiConfig).toEqual(aiConfig);
  });
});

describe('downloadModel', () => {
  test('download model if not already on disk', async () => {
    const isModelOnDiskMock = vi.fn().mockReturnValue(false);
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      { isModelOnDisk: isModelOnDiskMock } as unknown as ModelsManager,
    );
    const doDownloadModelWrapperMock = vi
      .spyOn(manager, 'doDownloadModelWrapper')
      .mockImplementation((_modelId: string, _url: string, _taskUtil: RecipeStatusUtils, _destFileName?: string) => {
        return Promise.resolve('');
      });
    await manager.downloadModel(
      {
        id: 'id',
        url: 'url',
        name: 'name',
      } as ModelInfo,
      taskUtils,
    );
    expect(doDownloadModelWrapperMock).toBeCalledWith('id', 'url', taskUtils);
    expect(setTaskMock).toHaveBeenLastCalledWith({
      id: 'id',
      name: 'Downloading model name',
      labels: {
        'model-pulling': 'id',
      },
      state: 'loading',
    });
  });
  test('retrieve model path if already on disk', async () => {
    const isModelOnDiskMock = vi.fn().mockReturnValue(true);
    const getLocalModelPathMock = vi.fn();
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {
        isModelOnDisk: isModelOnDiskMock,
        getLocalModelPath: getLocalModelPathMock,
      } as unknown as ModelsManager,
    );
    await manager.downloadModel(
      {
        id: 'id',
        url: 'url',
        name: 'name',
      } as ModelInfo,
      taskUtils,
    );
    expect(getLocalModelPathMock).toBeCalledWith('id');
    expect(setTaskMock).toHaveBeenLastCalledWith({
      id: 'id',
      name: 'Model name already present on disk',
      labels: {
        'model-pulling': 'id',
      },
      state: 'success',
    });
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
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
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
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
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
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    const containers = manager.filterContainers(aiConfig);
    expect(containers.length).toBe(2);
    expect(containers[0].name).equal('container1');
    expect(containers[1].name).equal('container3');
  });
});

describe('getRandomName', () => {
  test('return base name plus random string', () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    const randomName = manager.getRandomName('base');
    expect(randomName).not.equal('base');
    expect(randomName.length).toBeGreaterThan(4);
  });
  test('return random string when base is empty', () => {
    const manager = new ApplicationManager(
      '/home/user/aistudio',
      {} as unknown as GitManager,
      {} as unknown as RecipeStatusRegistry,
      {} as unknown as ModelsManager,
    );
    const randomName = manager.getRandomName('');
    expect(randomName.length).toBeGreaterThan(0);
  });
});

describe('buildImages', () => {
  const containers: ContainerConfig[] = [
    {
      name: 'container1',
      contextdir: 'contextdir1',
      containerfile: 'Containerfile',
      arch: ['amd64'],
      modelService: false,
      gpu_env: [],
    },
  ];
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  test('setTaskState should be called with error if context does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    mocks.listImagesMock.mockRejectedValue([]);
    await expect(manager.buildImages(containers, 'config', taskUtils)).rejects.toThrow(
      'Context configured does not exist.',
    );
  });
  test('setTaskState should be called with error if buildImage executon fails', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mocks.builImageMock.mockRejectedValue('error');
    mocks.listImagesMock.mockRejectedValue([]);
    await expect(manager.buildImages(containers, 'config', taskUtils)).rejects.toThrow(
      'Something went wrong while building the image: error',
    );
    expect(setTaskStateMock).toBeCalledWith('container1', 'error');
  });
  test('setTaskState should be called with error if unable to find the image after built', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mocks.builImageMock.mockResolvedValue({});
    mocks.listImagesMock.mockResolvedValue([]);
    await expect(manager.buildImages(containers, 'config', taskUtils)).rejects.toThrow(
      'no image found for container1:latest',
    );
    expect(setTaskStateMock).toBeCalledWith('container1', 'error');
  });
  test('succeed if building image do not fail', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mocks.builImageMock.mockResolvedValue({});
    mocks.listImagesMock.mockResolvedValue([
      {
        RepoTags: ['container1:latest'],
        engineId: 'engine',
        Id: 'id1',
      },
    ]);
    mocks.getImageInspectMock.mockResolvedValue({
      Config: {
        ExposedPorts: {
          '8080': '8080',
        },
      },
    });
    const imageInfoList = await manager.buildImages(containers, 'config', taskUtils);
    expect(setTaskStateMock).toBeCalledWith('container1', 'success');
    expect(imageInfoList.length).toBe(1);
    expect(imageInfoList[0].ports.length).toBe(1);
    expect(imageInfoList[0].ports[0]).equals('8080');
  });
});

describe('createPod', async () => {
  const imageInfo1: ImageInfo = {
    id: 'id',
    appName: 'appName',
    modelService: false,
    ports: ['8080'],
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
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  test('throw an error if there is no sample image', async () => {
    const images = [imageInfo2];
    await expect(manager.createPod(images)).rejects.toThrowError('no sample app found');
  });
  test('call createPod with sample app exposed port', async () => {
    const images = [imageInfo1, imageInfo2];
    vi.spyOn(manager, 'getRandomName').mockReturnValue('name');
    vi.spyOn(portsUtils, 'getPortsInfo').mockResolvedValue('9000');
    await manager.createPod(images);
    expect(mocks.createPodMock).toBeCalledWith({
      name: 'name',
      portmappings: [
        {
          container_port: 8080,
          host_port: 9000,
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
    });
  });
});

describe('createApplicationPod', () => {
  const imageInfo1: ImageInfo = {
    id: 'id',
    appName: 'appName',
    modelService: false,
    ports: ['8080'],
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
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  const images = [imageInfo1, imageInfo2];
  test('throw if createPod fails', async () => {
    vi.spyOn(manager, 'createPod').mockRejectedValue('error createPod');
    await expect(manager.createApplicationPod(images, 'path', taskUtils)).rejects.toThrowError('error createPod');
    expect(setTaskMock).toBeCalledWith({
      id: 'fake-pod-id',
      state: 'error',
      name: 'Creating application',
    });
  });
  test('call createAndAddContainersToPod after pod is created', async () => {
    const pod: PodInfo = {
      engineId: 'engine',
      Id: 'id',
    };
    vi.spyOn(manager, 'createPod').mockResolvedValue(pod);
    const createAndAddContainersToPodMock = vi
      .spyOn(manager, 'createAndAddContainersToPod')
      .mockImplementation((_pod: PodInfo, _images: ImageInfo[], _modelPath: string) => Promise.resolve([]));
    await manager.createApplicationPod(images, 'path', taskUtils);
    expect(createAndAddContainersToPodMock).toBeCalledWith(pod, images, 'path');
    expect(setTaskMock).toBeCalledWith({
      id: 'id',
      state: 'success',
      name: 'Creating application',
    });
  });
});

describe('doDownloadModelWrapper', () => {
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  test('returning model path if model has been downloaded', async () => {
    vi.spyOn(manager, 'doDownloadModel').mockImplementation(
      (
        _modelId: string,
        _url: string,
        _taskUtil: RecipeStatusUtils,
        callback: (message: DownloadModelResult) => void,
        _destFileName?: string,
      ) => {
        callback({
          successful: true,
          path: 'path',
        });
      },
    );
    setTaskStateMock.mockReturnThis();
    const result = await manager.doDownloadModelWrapper('id', 'url', taskUtils);
    expect(result).toBe('path');
  });
  test('rejecting with error message if model has NOT been downloaded', async () => {
    vi.spyOn(manager, 'doDownloadModel').mockImplementation(
      (
        _modelId: string,
        _url: string,
        _taskUtil: RecipeStatusUtils,
        callback: (message: DownloadModelResult) => void,
        _destFileName?: string,
      ) => {
        callback({
          successful: false,
          error: 'error',
        });
      },
    );
    setTaskStateMock.mockReturnThis();
    await expect(manager.doDownloadModelWrapper('id', 'url', taskUtils)).rejects.toThrowError('error');
  });
});

describe('restartContainerWhenEndpointIsUp', () => {
  const containerAttachedInfo: ContainerAttachedInfo = {
    name: 'name',
    endPoint: 'endpoint',
  };
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  test('restart container if endpoint is alive', async () => {
    vi.spyOn(utils, 'isEndpointAlive').mockResolvedValue(true);
    await manager.restartContainerWhenEndpointIsUp('engine', containerAttachedInfo);
    expect(mocks.startContainerMock).toBeCalledWith('engine', 'name');
  });
});

describe('runApplication', () => {
  const manager = new ApplicationManager(
    '/home/user/aistudio',
    {} as unknown as GitManager,
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as ModelsManager,
  );
  const pod: PodInfo = {
    engineId: 'engine',
    Id: 'id',
    containers: [
      {
        name: 'first',
        endPoint: 'url',
      },
      {
        name: 'second',
      },
    ],
  };
  test('check startPod is called and also restartContainerWhenEndpointIsUp for sample app', async () => {
    const restartContainerWhenEndpointIsUpMock = vi
      .spyOn(manager, 'restartContainerWhenEndpointIsUp')
      .mockImplementation((_engineId: string, _container: ContainerAttachedInfo) => Promise.resolve());
    await manager.runApplication(pod, taskUtils);
    expect(mocks.startPod).toBeCalledWith(pod.engineId, pod.Id);
    expect(restartContainerWhenEndpointIsUpMock).toBeCalledWith(pod.engineId, {
      name: 'first',
      endPoint: 'url',
    });
  });
});
