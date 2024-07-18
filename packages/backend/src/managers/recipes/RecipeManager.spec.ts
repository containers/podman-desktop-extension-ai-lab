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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { BuilderManager } from './BuilderManager';
import type { GitManager } from '../gitManager';
import type { LocalRepositoryRegistry } from '../../registries/LocalRepositoryRegistry';
import { RecipeManager } from './RecipeManager';
import { containerEngine } from '@podman-desktop/api';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { Stats } from 'node:fs';
import { existsSync, statSync } from 'node:fs';
import { parseYamlFile } from '../../models/AIConfig';
import { goarch } from '../../utils/arch';

const taskRegistryMock = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
} as unknown as TaskRegistry;

const builderManagerMock = {
  build: vi.fn(),
} as unknown as BuilderManager;

const gitManagerMock = {
  processCheckout: vi.fn(),
} as unknown as GitManager;

const localRepositoriesMock = {
  register: vi.fn(),
} as unknown as LocalRepositoryRegistry;

const recipeMock: Recipe = {
  id: 'recipe-test',
  name: 'Test Recipe',
  categories: [],
  description: 'test recipe description',
  repository: 'http://test-repository.test',
  readme: 'test recipe readme',
};

vi.mock('../../models/AIConfig', () => ({
  parseYamlFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    listImages: vi.fn(),
  },
}));

vi.mock('../../utils/arch', () => ({
  goarch: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(containerEngine.listImages).mockResolvedValue([]);
  vi.mocked(taskRegistryMock.createTask).mockImplementation((name, state, labels) => ({
    name,
    state,
    labels,
    id: 'fake-task',
  }));

  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(statSync).mockReturnValue({
    isDirectory: () => true,
  } as unknown as Stats);

  vi.mocked(parseYamlFile).mockReturnValue({
    application: {
      containers: [
        {
          arch: ['dummy-arch'],
          modelService: false,
          name: 'test-container',
          gpu_env: [],
          contextdir: '.',
        },
      ],
    },
  });

  vi.mocked(goarch).mockReturnValue('dummy-arch');
});

async function getInitializedRecipeManager(): Promise<RecipeManager> {
  const manager = new RecipeManager(
    'test-app-user-directory',
    gitManagerMock,
    taskRegistryMock,
    builderManagerMock,
    localRepositoriesMock,
  );
  manager.init();
  return manager;
}

describe('cloneRecipe', () => {
  test('error in checkout should set the task to error and propagate it', async () => {
    vi.mocked(gitManagerMock.processCheckout).mockRejectedValue(new Error('clone error'));

    const manager = await getInitializedRecipeManager();

    await expect(() => {
      return manager.cloneRecipe(recipeMock);
    }).rejects.toThrowError('clone error');

    expect(taskRegistryMock.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'error',
      }),
    );
  });

  test('labels should be propagated', async () => {
    const manager = await getInitializedRecipeManager();
    await manager.cloneRecipe(recipeMock, {
      'test-label': 'test-value',
    });

    expect(gitManagerMock.processCheckout).toHaveBeenCalledWith({
      repository: recipeMock.repository,
      ref: recipeMock.ref,
      targetDirectory: expect.any(String),
    });

    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Checking out repository', 'loading', {
      'test-label': 'test-value',
      'recipe-id': recipeMock.id,
      git: 'checkout',
    });

    expect(localRepositoriesMock.register).toHaveBeenCalledWith({
      path: expect.any(String),
      sourcePath: expect.any(String),
      labels: {
        'recipe-id': recipeMock.id,
      },
    });
  });
});

describe('buildRecipe', () => {
  test('error in build propagate it', async () => {
    vi.mocked(builderManagerMock.build).mockRejectedValue(new Error('build error'));

    const manager = await getInitializedRecipeManager();

    await expect(() => {
      return manager.buildRecipe(recipeMock);
    }).rejects.toThrowError('build error');
  });

  test('labels should be propagated', async () => {
    const manager = await getInitializedRecipeManager();

    await manager.buildRecipe(recipeMock, {
      'test-label': 'test-value',
    });

    expect(taskRegistryMock.createTask).toHaveBeenCalledWith('Loading configuration', 'loading', {
      'test-label': 'test-value',
      'recipe-id': recipeMock.id,
    });

    expect(builderManagerMock.build).toHaveBeenCalledWith(
      recipeMock,
      [
        {
          arch: ['dummy-arch'],
          modelService: false,
          name: 'test-container',
          gpu_env: [],
          contextdir: '.',
        },
      ],
      expect.any(String),
      {
        'test-label': 'test-value',
        'recipe-id': recipeMock.id,
      },
    );
  });
});
