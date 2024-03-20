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

import * as fs from 'node:fs';

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
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json');
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
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
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
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));

  catalogManager.init();
  await vi.waitUntil(() => catalogManager.getRecipes().length > 0);

  const model = catalogManager.getModelById('model1');
  expect(model).toBeDefined();
  expect(model.name).toEqual('Model 1');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual('https://model1.example.com');
});
