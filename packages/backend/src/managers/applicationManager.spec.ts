import { type MockInstance, describe, expect, test, vi, beforeEach } from 'vitest';
import { ApplicationManager } from './applicationManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { GitManager } from './gitManager';
import os from 'os';
import fs from 'node:fs';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { RecipeStatusUtils } from '../utils/recipeStatusUtils';
import type { ModelsManager } from './modelsManager';

const mocks = vi.hoisted(() => {
  return {
    parseYamlMock: vi.fn(),
    builImageMock: vi.fn(),
    listImagesMock: vi.fn(),
    getImageInspectMock: vi.fn(),
    createPodMock: vi.fn(),
    createContainerMock: vi.fn(),
    replicatePodmanContainerMock: vi.fn(),
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
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
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
    expect(downloadModelMainSpy).not.toHaveBeenCalled();
  });
});
