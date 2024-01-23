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
  };
});

vi.mock('../models/AIConfig', () => ({
  parseYaml: mocks.parseYamlMock,
}));

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    buildImage: mocks.builImageMock,
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
  const getLocalModelsMock = vi.fn();
  let manager: ApplicationManager;
  let downloadModelMainSpy: MockInstance<
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

    manager = new ApplicationManager(
      '/home/user/aistudio',
      {
        cloneRepository: cloneRepositoryMock,
      } as unknown as GitManager,
      {
        setStatus: setStatusMock,
      } as unknown as RecipeStatusRegistry,
      {
        getLocalModels: getLocalModelsMock,
      } as unknown as ModelsManager,
    );

    downloadModelMainSpy = vi.spyOn(manager, 'downloadModelMain');
    downloadModelMainSpy.mockResolvedValue('');
  }

  test('pullApplication should clone repository and call downloadModelMain and buildImage', async () => {
    mockForPullApplication({
      recipeFolderExists: false,
    });
    getLocalModelsMock.mockReturnValue([]);

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
    expect(downloadModelMainSpy).toHaveBeenCalledOnce();
    expect(mocks.builImageMock).toHaveBeenCalledOnce();
  });

  test('pullApplication should not clone repository if folder already exists locally', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });
    getLocalModelsMock.mockReturnValue([]);

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
    getLocalModelsMock.mockReturnValue([
      {
        id: 'model1',
        file: 'model1.file',
      },
    ]);

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
    expect(downloadModelMainSpy).not.toHaveBeenCalled();
  });
});
