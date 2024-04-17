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
import { type Webview, EventEmitter } from '@podman-desktop/api';
import { CatalogManager } from './catalogManager';

import type { Stats } from 'node:fs';
import { promises, existsSync } from 'node:fs';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import path from 'node:path';

vi.mock('./ai.json', () => {
  return {
    default: content,
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      stat: vi.fn(),
      writeFile: vi.fn(),
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
  // Creating CatalogManager
  catalogManager = new CatalogManager(
    {
      postMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as Webview,
    appUserDirectory,
  );

  vi.mock('node:fs');

  const listeners: ((value: unknown) => void)[] = [];

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);
});

describe('invalid user catalog', () => {
  beforeEach(async () => {
    vi.spyOn(promises, 'readFile').mockResolvedValue('invalid json');
    catalogManager.init();
  });

  test('expect correct model is returned with valid id', () => {
    const model = catalogManager.getModelById('hf.TheBloke.mistral-7b-instruct-v0.1.Q4_K_M');
    expect(model).toBeDefined();
    expect(model.name).toEqual('TheBloke/Mistral-7B-Instruct-v0.1-GGUF');
    expect(model.registry).toEqual('Hugging Face');
    expect(model.url).toEqual(
      'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf',
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

  const model = catalogManager.getModelById('hf.TheBloke.mistral-7b-instruct-v0.1.Q4_K_M');
  expect(model).toBeDefined();
  expect(model.name).toEqual('TheBloke/Mistral-7B-Instruct-v0.1-GGUF');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual(
    'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q4_K_M.gguf',
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

  const updatedCatalog: ApplicationCatalog = Object.assign({}, userContent);
  updatedCatalog.models.push({
    id: '/root/path/file.gguf',
    name: 'custom-model',
    description: `Model imported from /root/path/file.gguf`,
    hw: 'CPU',
    file: {
      path: '/root/path',
      file: 'file.gguf',
      size: 1,
      creation: mtimeDate,
    },
    memory: 1,
  });
  const writeFileMock = vi.spyOn(promises, 'writeFile').mockResolvedValue();

  await catalogManager.importUserModels([
    {
      name: 'custom-model',
      path: '/root/path/file.gguf',
    },
  ]);

  expect(writeFileMock).toBeCalledWith('path', JSON.stringify(updatedCatalog, undefined, 2), 'utf-8');
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

  expect(writeFileMock).toBeCalledWith('path', JSON.stringify(updatedCatalog, undefined, 2), 'utf-8');
});
