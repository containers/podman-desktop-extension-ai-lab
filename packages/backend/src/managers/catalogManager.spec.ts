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
import content from '../ai-test.json';
import userContent from '../ai-user-test.json';
import type { Webview } from '@podman-desktop/api';
import { CatalogManager } from '../managers/catalogManager';

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

vi.mock('@podman-desktop/api', () => {
  return {
    fs: {
      createFileSystemWatcher: () => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
  };
});

const mocks = vi.hoisted(() => ({
  withProgressMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
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
  const appUserDirectory = '.';

  // Creating CatalogManager
  catalogManager = new CatalogManager(appUserDirectory, {
    postMessage: vi.fn(),
  } as unknown as Webview);
  vi.resetAllMocks();
  vi.mock('node:fs');
});

describe('invalid user catalog', () => {
  beforeEach(async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json');
    await catalogManager.loadCatalog();
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
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  await catalogManager.loadCatalog();
  const model = catalogManager.getModelById('llama-2-7b-chat.Q5_K_S');
  expect(model).toBeDefined();
  expect(model.name).toEqual('Llama-2-7B-Chat-GGUF');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual(
    'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
  );
});

test('expect correct model is returned with valid id when the user catalog is valid', async () => {
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));

  await catalogManager.loadCatalog();
  const model = catalogManager.getModelById('model1');
  expect(model).toBeDefined();
  expect(model.name).toEqual('Model 1');
  expect(model.registry).toEqual('Hugging Face');
  expect(model.url).toEqual('https://model1.example.com');
});
