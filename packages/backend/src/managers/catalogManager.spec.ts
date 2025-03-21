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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import content from '../tests/ai-test.json';
import userContent from '../tests/ai-user-test.json';
import { EventEmitter, window } from '@podman-desktop/api';
import { CatalogManager } from './catalogManager';

import type { Stats } from 'node:fs';
import { promises, existsSync } from 'node:fs';
import type { ApplicationCatalog } from '@shared/models/IApplicationCatalog';
import path from 'node:path';
import { version } from '../assets/ai.json';
import * as catalogUtils from '../utils/catalogUtils';
import type { RpcExtension } from '@shared/messages/MessageProxy';

vi.mock('../assets/ai.json', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { version } = await importOriginal<typeof import('../assets/ai.json')>();
  return {
    default: { ...content, version: version },
    version: version,
  };
});

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('node:path');

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    window: {
      showNotification: vi.fn(),
    },
    ProgressLocation: {
      TASK_WIDGET: 'TASK_WIDGET',
    },
    fs: {
      createFileSystemWatcher: (): unknown => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
  };
});

let catalogManager: CatalogManager;

beforeEach(async () => {
  vi.resetAllMocks();

  // mock EventEmitter logic for all tests
  vi.mocked(EventEmitter).mockImplementation(() => {
    const listeners: ((value: unknown) => void)[] = [];
    return {
      event: vi.fn().mockImplementation(callback => {
        listeners.push(callback);
      }),
      fire: vi.fn().mockImplementation((content: unknown) => {
        listeners.forEach(listener => listener(content));
      }),
    } as unknown as EventEmitter<unknown>;
  });

  const appUserDirectory = '.';

  // Creating CatalogManager
  catalogManager = new CatalogManager(
    {
      fire: vi.fn().mockResolvedValue(true),
    } as unknown as RpcExtension,
    appUserDirectory,
  );
});

describe('invalid user catalog', () => {
  beforeEach(async () => {
    vi.mocked(promises.readFile).mockResolvedValue('invalid json');
    catalogManager.init();
  });

  test('expect correct model is returned with valid id', () => {
    const model = catalogManager.getModelById('llama-2-7b-chat.Q5_K_S');
    expect(model).toBeDefined();
    expect(model.name).toEqual('Llama-2-7B-Chat-GGUF');
    expect(model.registry).toEqual('Hugging Face');
    expect(model.url).toEqual(
      'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    );
  });

  test('expect error if id does not correspond to any model', () => {
    expect(() => catalogManager.getModelById('unknown')).toThrowError('No model found having id unknown');
  });
});

test('expect correct model is returned from default catalog with valid id when no user catalog exists', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  const model = catalogManager.getModelById('llama-2-7b-chat.Q5_K_S');
  expect(model).toBeDefined();
  expect(model.name).toEqual('Llama-2-7B-Chat-GGUF');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual(
    'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
  );
});

test('expect correct model is returned with valid id when the user catalog is valid', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));

  const model = catalogManager.getModelById('model1');
  expect(model).toBeDefined();
  expect(model.name).toEqual('Model 1');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual('https://model1.example.com');
});

test('expect to call writeFile in addLocalModelsToCatalog with catalog updated', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.mocked(promises.stat).mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.mocked(path.resolve).mockReturnValue('path');

  vi.mocked(promises.writeFile).mockResolvedValue();

  await catalogManager.importUserModels([
    {
      name: 'custom-model',
      path: '/root/path/file.gguf',
    },
  ]);

  expect(promises.mkdir).toHaveBeenCalled();
  expect(promises.writeFile).toBeCalledWith('path', expect.any(String), 'utf-8');
});

test('expect to call writeFile in removeLocalModelFromCatalog with catalog updated', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));
  vi.mocked(path.resolve).mockReturnValue('path');

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  vi.mocked(promises.writeFile).mockResolvedValue();

  const updatedCatalog: ApplicationCatalog = { ...userContent };
  updatedCatalog.models = updatedCatalog.models.filter(m => m.id !== 'model1');

  await catalogManager.removeUserModel('model1');

  expect(promises.writeFile).toBeCalledWith(
    'path',
    expect.stringContaining(`"version": "${catalogUtils.CatalogFormat.CURRENT}"`),
    'utf-8',
  );
});

test('catalog should be the combination of user catalog and default catalog', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));
  vi.mocked(path.resolve).mockReturnValue('path');

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().length > userContent.models.length);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.mocked(promises.stat).mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.mocked(path.resolve).mockReturnValue('path');

  const catalog = catalogManager.getCatalog();

  expect(catalog).toEqual({
    version: catalogUtils.CatalogFormat.CURRENT,
    recipes: [...content.recipes, ...userContent.recipes],
    models: [...content.models, ...userContent.models],
    categories: [...content.categories, ...userContent.categories],
  });
});

test('catalog should use user items in favour of default', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(path.resolve).mockReturnValue('path');

  const overwriteFullCatalog: ApplicationCatalog = {
    version: catalogUtils.CatalogFormat.CURRENT,
    recipes: content.recipes.map(recipe => ({
      ...recipe,
      name: 'user-recipe-overwrite',
    })),
    models: content.models.map(model => ({
      ...model,
      name: 'user-model-overwrite',
    })),
    categories: content.categories.map(category => ({
      ...category,
      name: 'user-model-overwrite',
    })),
  };

  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(overwriteFullCatalog));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().length > 0);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.mocked(promises.stat).mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.mocked(path.resolve).mockReturnValue('path');

  const catalog = catalogManager.getCatalog();

  expect(catalog).toEqual(overwriteFullCatalog);
});

test('default catalog should have latest version', () => {
  expect(version).toBe(catalogUtils.CatalogFormat.CURRENT);
});

test('wrong catalog version should create a notification', () => {
  catalogManager['onUserCatalogUpdate']({ version: catalogUtils.CatalogFormat.UNKNOWN });

  expect(window.showNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Incompatible user-catalog',
    }),
  );
});

test('malformed catalog should create a notification', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(path.resolve).mockReturnValue('path');

  catalogManager['onUserCatalogUpdate']({
    version: catalogUtils.CatalogFormat.CURRENT,
    models: [
      {
        fakeProperty: 'hello',
      },
    ],
    recipes: [],
    categories: [],
  });

  expect(window.showNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Error loading the user catalog',
      body: 'Something went wrong while trying to load the user catalog: Error: invalid model format',
    }),
  );
});

describe('spy on catalogUtils.sanitize', () => {
  beforeEach(() => {
    // do not mock the complete catalogUtils module but only spy the `sanitize` function,
    // as we want to keep the original `catalogUtils.hasCatalogWrongFormat` function
    vi.spyOn(catalogUtils, 'sanitize');
  });

  afterEach(() => {
    vi.mocked(catalogUtils.sanitize).mockRestore();
  });

  test('catalog with undefined version should call sanitize function to try converting it', () => {
    vi.mocked(promises.writeFile).mockResolvedValue();
    catalogManager['onUserCatalogUpdate']({
      recipes: [
        {
          id: 'chatbot',
          description: 'This is a Streamlit chat demo application.',
          name: 'ChatBot',
          repository: 'https://github.com/containers/ai-lab-recipes',
          ref: 'v1.1.3',
          icon: 'natural-language-processing',
          categories: ['natural-language-processing'],
          basedir: 'recipes/natural_language_processing/chatbot',
          readme: '',
          models: ['hf.instructlab.granite-7b-lab-GGUF', 'hf.instructlab.merlinite-7b-lab-GGUF'],
        },
      ],
      models: [],
    });

    expect(catalogUtils.sanitize).toHaveBeenCalled();
    expect(promises.writeFile).toHaveBeenCalled();
  });
});

test('filter recipes by language', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));
  const result1 = catalogManager.filterRecipes({
    languages: ['lang1'],
  });
  expect(result1.result.map(r => r.id)).toEqual(['recipe1']);
  expect(result1.choices).toEqual({
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 2 },
      { name: 'lang11', count: 1 },
      { name: 'lang2', count: 1 },
      { name: 'lang3', count: 1 },
    ],
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 1 },
    ],
    tools: [{ name: 'tool1', count: 1 }],
  });

  const result2 = catalogManager.filterRecipes({
    languages: ['lang2'],
  });
  expect(result2.result.map(r => r.id)).toEqual(['recipe2']);
  expect(result2.choices).toEqual({
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 2 },
      { name: 'lang11', count: 1 },
      { name: 'lang2', count: 1 },
      { name: 'lang3', count: 1 },
    ],
    frameworks: [
      { name: 'fw10', count: 1 },
      { name: 'fw2', count: 1 },
    ],
    tools: [{ name: 'tool2', count: 1 }],
  });
});

test('filter recipes by tool', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));

  const result1 = catalogManager.filterRecipes({
    tools: ['tool1'],
  });
  expect(result1.result.map(r => r.id)).toEqual(['recipe1']);
  expect(result1.choices).toEqual({
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 1 },
    ],
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 1 },
    ],
    tools: [
      { name: 'tool1', count: 1 },
      { name: 'tool2', count: 1 },
      { name: 'tool3', count: 1 },
    ],
  });

  const result2 = catalogManager.filterRecipes({
    tools: ['tool2'],
  });
  expect(result2.result.map(r => r.id)).toEqual(['recipe2']);
  expect(result2.choices).toEqual({
    frameworks: [
      { name: 'fw10', count: 1 },
      { name: 'fw2', count: 1 },
    ],
    languages: [
      { name: 'lang10', count: 1 },
      { name: 'lang2', count: 1 },
    ],
    tools: [
      { name: 'tool1', count: 1 },
      { name: 'tool2', count: 1 },
      { name: 'tool3', count: 1 },
    ],
  });

  const result3 = catalogManager.filterRecipes({
    tools: ['tool1', 'tool2'],
  });
  expect(result3.result.map(r => r.id)).toEqual(['recipe1', 'recipe2']);
  expect(result3.choices).toEqual({
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 2 },
      { name: 'fw2', count: 1 },
    ],
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 2 },
      { name: 'lang2', count: 1 },
    ],
    tools: [
      { name: 'tool1', count: 1 },
      { name: 'tool2', count: 1 },
      { name: 'tool3', count: 1 },
    ],
  });
});

test('filter recipes by framework', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));

  const result1 = catalogManager.filterRecipes({
    frameworks: ['fw1'],
  });
  expect(result1.result.map(r => r.id)).toEqual(['recipe1']);
  expect(result1.choices).toEqual({
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 1 },
    ],
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 3 },
      { name: 'fw11', count: 1 },
      { name: 'fw2', count: 2 },
    ],
    tools: [{ name: 'tool1', count: 1 }],
  });

  const result2 = catalogManager.filterRecipes({
    frameworks: ['fw2'],
  });
  expect(result2.result.map(r => r.id)).toEqual(['recipe2', 'recipe3']);
  expect(result2.choices).toEqual({
    languages: [
      { name: 'lang10', count: 1 },
      { name: 'lang11', count: 1 },
      { name: 'lang2', count: 1 },
      { name: 'lang3', count: 1 },
    ],
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 3 },
      { name: 'fw11', count: 1 },
      { name: 'fw2', count: 2 },
    ],
    tools: [
      { name: 'tool2', count: 1 },
      { name: 'tool3', count: 1 },
    ],
  });

  const result3 = catalogManager.filterRecipes({
    frameworks: ['fw1', 'fw2'],
  });
  expect(result3.result.map(r => r.id)).toEqual(['recipe1', 'recipe2', 'recipe3']);
  expect(result3.choices).toEqual({
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 2 },
      { name: 'lang11', count: 1 },
      { name: 'lang2', count: 1 },
      { name: 'lang3', count: 1 },
    ],
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 3 },
      { name: 'fw11', count: 1 },
      { name: 'fw2', count: 2 },
    ],
    tools: [
      { name: 'tool1', count: 1 },
      { name: 'tool2', count: 1 },
      { name: 'tool3', count: 1 },
    ],
  });
});

test('filter recipes by language and framework', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));

  const result1 = catalogManager.filterRecipes({
    languages: ['lang2'],
    frameworks: ['fw2'],
  });
  expect(result1.result.map(r => r.id)).toEqual(['recipe2']);
  expect(result1.choices).toEqual({
    languages: [
      { name: 'lang10', count: 1 },
      { name: 'lang11', count: 1 },
      { name: 'lang2', count: 1 },
      { name: 'lang3', count: 1 },
    ],
    frameworks: [
      { name: 'fw10', count: 1 },
      { name: 'fw2', count: 1 },
    ],
    tools: [{ name: 'tool2', count: 1 }],
  });
});

test('filter recipes by language, tool and framework', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().some(model => model.id === 'model1'));

  const result1 = catalogManager.filterRecipes({
    languages: ['lang1'],
    tools: ['tool1'],
    frameworks: ['fw1'],
  });
  expect(result1.result.map(r => r.id)).toEqual(['recipe1']);
  expect(result1.choices).toEqual({
    languages: [
      { name: 'lang1', count: 1 },
      { name: 'lang10', count: 1 },
    ],
    frameworks: [
      { name: 'fw1', count: 1 },
      { name: 'fw10', count: 1 },
    ],
    tools: [{ name: 'tool1', count: 1 }],
  });
});
