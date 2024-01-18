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
import content from './ai-test.json';
import userContent from './ai-user-test.json';
import type { ApplicationManager } from './managers/applicationManager';
import type { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import { StudioApiImpl } from './studio-api-impl';
import type { PlayGroundManager } from './playground';
import type { TaskRegistry } from './registries/TaskRegistry';

import * as fs from 'node:fs';

vi.mock('./ai.json', () => {
  return {
    default: content,
  };
});

let studioApiImpl: StudioApiImpl;

beforeEach(async () => {
  studioApiImpl = new StudioApiImpl(
    {
      appUserDirectory: '.',
    } as unknown as ApplicationManager,
    {} as unknown as RecipeStatusRegistry,
    {} as unknown as TaskRegistry,
    {} as unknown as PlayGroundManager,
  );
});

describe('no valid user catalog', () => {
  beforeEach(async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json');
    await studioApiImpl.loadCatalog();
  });

  test('expect correct model is returned with valid id', async () => {
    const model = await studioApiImpl.getModelById('llama-2-7b-chat.Q5_K_S');
    expect(model).toBeDefined();
    expect(model.name).toEqual('Llama-2-7B-Chat-GGUF');
    expect(model.registry).toEqual('Hugging Face');
    expect(model.url).toEqual(
      'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    );
  });

  test('expect error if id does not correspond to any model', async () => {
    await expect(() => studioApiImpl.getModelById('unknown')).rejects.toThrowError('No model found having id unknown');
  });

  test('expect array of models based on list of ids', async () => {
    const models = await studioApiImpl.getModelsByIds(['llama-2-7b-chat.Q5_K_S', 'albedobase-xl-1.3']);
    expect(models).toBeDefined();
    expect(models.length).toBe(2);
    expect(models[0].name).toEqual('Llama-2-7B-Chat-GGUF');
    expect(models[0].registry).toEqual('Hugging Face');
    expect(models[0].url).toEqual(
      'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    );
    expect(models[1].name).toEqual('AlbedoBase XL 1.3');
    expect(models[1].registry).toEqual('Civital');
    expect(models[1].url).toEqual('');
  });

  test('expect empty array if input list is empty', async () => {
    const models = await studioApiImpl.getModelsByIds([]);
    expect(models).toBeDefined();
    expect(models.length).toBe(0);
  });

  test('expect empty array if input list has ids that are not in the catalog', async () => {
    const models = await studioApiImpl.getModelsByIds(['1', '2']);
    expect(models).toBeDefined();
    expect(models.length).toBe(0);
  });
});

describe('valid user catalog', () => {
  beforeEach(async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));
    await studioApiImpl.loadCatalog();
  });

  test('expect correct model is returned with valid id', async () => {
    const model = await studioApiImpl.getModelById('model1');
    expect(model).toBeDefined();
    expect(model.name).toEqual('Model 1');
    expect(model.registry).toEqual('Hugging Face');
    expect(model.url).toEqual('https://model1.example.com');
  });

  test('expect error if id does not correspond to any model', async () => {
    await expect(() => studioApiImpl.getModelById('unknown')).rejects.toThrowError('No model found having id unknown');
  });

  test('expect array of models based on list of ids', async () => {
    const models = await studioApiImpl.getModelsByIds(['model1', 'model2']);
    expect(models).toBeDefined();
    expect(models.length).toBe(2);
    expect(models[0].name).toEqual('Model 1');
    expect(models[0].registry).toEqual('Hugging Face');
    expect(models[0].url).toEqual('https://model1.example.com');
    expect(models[1].name).toEqual('Model 2');
    expect(models[1].registry).toEqual('Civital');
    expect(models[1].url).toEqual('');
  });

  test('expect empty array if input list is empty', async () => {
    const models = await studioApiImpl.getModelsByIds([]);
    expect(models).toBeDefined();
    expect(models.length).toBe(0);
  });

  test('expect empty array if input list has ids that are not in the catalog', async () => {
    const models = await studioApiImpl.getModelsByIds(['1', '2']);
    expect(models).toBeDefined();
    expect(models.length).toBe(0);
  });
});
