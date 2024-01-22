import { expect, test, vi } from 'vitest';
import { ApplicationManager } from './applicationManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { ExtensionContext } from '@podman-desktop/api';
import type { GitManager } from './gitManager';
import os from 'os';
import fs, { Stats, type Dirent } from 'fs';
import path from 'path';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const mocks = vi.hoisted(() => {
  return {
    parseYamlMock: vi.fn(),
  };
});

vi.mock('../models/AIConfig', () => ({
  parseYaml: mocks.parseYamlMock,
}));

test('appUserDirectory should be under home directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const manager = new ApplicationManager({} as GitManager, {} as RecipeStatusRegistry, {} as ExtensionContext);
  expect(manager.appUserDirectory).toMatch(/^(\/|\\)home(\/|\\)user/);
});

test('getLocalModels should return models in local directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(fs, 'readdirSync').mockImplementation((dir: string): any => {
    // TODO(feloy): fix any
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

test('pullApplication should clone repository and call downloadModelMain', async () => {
  const setStatusMock = vi.fn();
  const cloneRepositoryMock = vi.fn();
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  vi.spyOn(fs, 'existsSync').mockImplementation((path: string) => {
    if (path.endsWith('recipe1')) {
      return false;
    } else if (path.endsWith('ai-studio.yaml')) {
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
      containers: [],
    },
  });
  const manager = new ApplicationManager(
    {
      cloneRepository: cloneRepositoryMock,
    } as unknown as GitManager,
    {
      setStatus: setStatusMock,
    } as unknown as RecipeStatusRegistry,
    {} as ExtensionContext,
  );

  const getLocalModelsSpy = vi.spyOn(manager, 'getLocalModels');
  getLocalModelsSpy.mockReturnValue([]);
  const downloadModelMainSpy = vi.spyOn(manager, 'downloadModelMain');
  downloadModelMainSpy.mockResolvedValue('');

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
  expect(cloneRepositoryMock).toHaveBeenNthCalledWith(1, 'repo', '/home/user/podman-desktop/ai-studio/recipe1');
  expect(downloadModelMainSpy).toHaveBeenCalledOnce();
});
