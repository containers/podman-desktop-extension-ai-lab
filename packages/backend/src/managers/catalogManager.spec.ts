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

import { beforeEach, describe, expect, test, vi } from 'vitest';
import content from '../tests/ai-test.json';
import userContent from '../tests/ai-user-test.json';
import { type Webview, EventEmitter, window } from '@podman-desktop/api';
import { CatalogManager } from './catalogManager';

import type { Stats } from 'node:fs';
import { promises, existsSync } from 'node:fs';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import path from 'node:path';
import { version } from '../assets/ai.json';
import * as catalogUtils from '../utils/catalogUtils';

vi.mock('../assets/ai.json', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { version } = await importOriginal<typeof import('../assets/ai.json')>();
  return {
    default: { ...content, version: version },
    version: version,
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      stat: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

const mocks = vi.hoisted(() => ({
  withProgressMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    window: {
      withProgress: mocks.withProgressMock,
      showNotification: vi.fn(),
    },
    ProgressLocation: {
      TASK_WIDGET: 'TASK_WIDGET',
    },
    fs: {
      createFileSystemWatcher: () => ({
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

  const appUserDirectory = '.';

  vi.mock('node:fs');

  // mock EventEmitter logic
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

  // Creating CatalogManager
  catalogManager = new CatalogManager(
    {
      postMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as Webview,
    appUserDirectory,
  );
});

describe('invalid user catalog', () => {
  beforeEach(async () => {
    vi.spyOn(promises, 'readFile').mockResolvedValue('invalid json');
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
  vi.spyOn(promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));

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
  vi.spyOn(promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.spyOn(promises, 'stat').mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.spyOn(path, 'resolve').mockReturnValue('path');

  const writeFileMock = vi.spyOn(promises, 'writeFile').mockResolvedValue();

  await catalogManager.importUserModels([
    {
      name: 'custom-model',
      path: '/root/path/file.gguf',
    },
  ]);

  expect(promises.mkdir).toHaveBeenCalled();
  expect(writeFileMock).toBeCalledWith('path', expect.any(String), 'utf-8');
});

test('expect to call writeFile in removeLocalModelFromCatalog with catalog updated', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.spyOn(promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));
  vi.spyOn(path, 'resolve').mockReturnValue('path');

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  const writeFileMock = vi.spyOn(promises, 'writeFile').mockResolvedValue();

  const updatedCatalog: ApplicationCatalog = Object.assign({}, userContent);
  updatedCatalog.models = updatedCatalog.models.filter(m => m.id !== 'model1');

  await catalogManager.removeUserModel('model1');

  expect(writeFileMock).toBeCalledWith(
    'path',
    expect.stringContaining(`"version": "${catalogUtils.CatalogFormat.CURRENT}"`),
    'utf-8',
  );
});

test('catalog should be the combination of user catalog and default catalog', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.spyOn(promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));
  vi.spyOn(path, 'resolve').mockReturnValue('path');

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().length > userContent.models.length);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.spyOn(promises, 'stat').mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.spyOn(path, 'resolve').mockReturnValue('path');

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
  vi.spyOn(path, 'resolve').mockReturnValue('path');

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

  vi.spyOn(promises, 'readFile').mockResolvedValue(JSON.stringify(overwriteFullCatalog));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getModels().length > 0);

  const mtimeDate = new Date('2024-04-03T09:51:15.766Z');
  vi.spyOn(promises, 'stat').mockResolvedValue({
    size: 1,
    mtime: mtimeDate,
  } as Stats);
  vi.spyOn(path, 'resolve').mockReturnValue('path');

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
  vi.spyOn(path, 'resolve').mockReturnValue('path');

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

test('catalog with undefined version should call sanitize function to try converting it', () => {
  const sanitizeSpy = vi.spyOn(catalogUtils, 'sanitize');
  catalogManager['onUserCatalogUpdate']({
    models: [],
  });

  expect(sanitizeSpy).toHaveBeenCalled();
});
