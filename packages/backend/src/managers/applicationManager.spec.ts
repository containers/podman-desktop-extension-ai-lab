import { type MockInstance, describe, expect, test, vi, beforeEach } from 'vitest';
import { ApplicationManager } from './applicationManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { ExtensionContext } from '@podman-desktop/api';
import type { GitManager } from './gitManager';
import os from 'os';
import fs, { Stats, type Dirent } from 'fs';
import path from 'path';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import type { RecipeStatusUtils } from '../utils/recipeStatusUtils';

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

test('appUserDirectory should be under home directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const manager = new ApplicationManager({} as GitManager, {} as RecipeStatusRegistry, {} as ExtensionContext);
  if (process.platform === 'win32') {
    expect(manager.appUserDirectory).toMatch(/^\\home\\user/);
  } else {
    expect(manager.appUserDirectory).toMatch(/^\/home\/user/);
  }
});

test('getLocalModels should return models in local directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readdirSyncMock = vi.spyOn(fs, 'readdirSync') as unknown as MockInstance<
    [path: string],
    string[] | fs.Dirent[]
  >;
  readdirSyncMock.mockImplementation((dir: string) => {
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return [base + '-model'];
    } else {
      return [
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-1',
        },
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-2',
        },
        {
          isDirectory: () => false,
          path: '/home/user/appstudio-dir',
          name: 'other-file-should-be-ignored.txt',
        },
      ] as Dirent[];
    }
  });
  const manager = new ApplicationManager({} as GitManager, {} as RecipeStatusRegistry, {} as ExtensionContext);
  const models = manager.getLocalModels();
  expect(models).toEqual([
    {
      id: 'model-id-1',
      file: 'model-id-1-model',
    },
    {
      id: 'model-id-2',
      file: 'model-id-2-model',
    },
  ]);
});

describe('pullApplication', () => {
  interface mockForPullApplicationOptions {
    recipeFolderExists: boolean;
  }

  const setStatusMock = vi.fn();
  const cloneRepositoryMock = vi.fn();
  let manager: ApplicationManager;
  let getLocalModelsSpy: MockInstance<[], LocalModelInfo[]>;
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
        const stat = new Stats();
        stat.isDirectory = () => true;
        return stat;
      } else if (path.endsWith('ai-studio.yaml')) {
        const stat = new Stats();
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
      {
        cloneRepository: cloneRepositoryMock,
      } as unknown as GitManager,
      {
        setStatus: setStatusMock,
      } as unknown as RecipeStatusRegistry,
      {} as ExtensionContext,
    );

    getLocalModelsSpy = vi.spyOn(manager, 'getLocalModels');
    downloadModelMainSpy = vi.spyOn(manager, 'downloadModelMain');
    downloadModelMainSpy.mockResolvedValue('');
  }

  test('pullApplication should clone repository and call downloadModelMain and buildImage', async () => {
    mockForPullApplication({
      recipeFolderExists: false,
    });
    getLocalModelsSpy.mockReturnValue([]);

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
      expect(cloneRepositoryMock).toHaveBeenNthCalledWith(
        1,
        'repo',
        '\\home\\user\\podman-desktop\\ai-studio\\recipe1',
      );
    } else {
      expect(cloneRepositoryMock).toHaveBeenNthCalledWith(1, 'repo', '/home/user/podman-desktop/ai-studio/recipe1');
    }
    expect(downloadModelMainSpy).toHaveBeenCalledOnce();
    expect(mocks.builImageMock).toHaveBeenCalledOnce();
  });

  test('pullApplication should not clone repository if folder already exists locally', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });
    getLocalModelsSpy.mockReturnValue([]);

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
    getLocalModelsSpy.mockReturnValue([
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

  test('pullApplication should mark the loading config as error if not container are found', async () => {
    mockForPullApplication({
      recipeFolderExists: true,
    });
    getLocalModelsSpy.mockReturnValue([
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
