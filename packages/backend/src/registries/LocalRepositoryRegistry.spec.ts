/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import { beforeEach, expect, test, vi } from 'vitest';
import { LocalRepositoryRegistry } from './LocalRepositoryRegistry';
import type { Recipe } from '@shared/src/models/IRecipe';
import fs from 'node:fs';
import path from 'node:path';
import type { CatalogManager } from '../managers/catalogManager';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import type { RpcExtension } from '@shared/src/messages/MessageProxy';
import { MSG_LOCAL_REPOSITORY_UPDATE } from '@shared/Messages';

const mocks = vi.hoisted(() => ({
  DisposableCreateMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    Disposable: {
      create: mocks.DisposableCreateMock,
    },
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    promises: {
      rm: vi.fn(),
    },
  };
});

const catalogManagerMock = {
  onUpdate: vi.fn(),
  getRecipes: vi.fn(),
} as unknown as CatalogManager;

const rpcExtensionMock = {
  fire: vi.fn(),
} as unknown as RpcExtension;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mock('node:fs');
  vi.mocked(rpcExtensionMock.fire).mockResolvedValue(true);
});

test('should not have any repositories by default', () => {
  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);
  expect(localRepositories.getLocalRepositories().length).toBe(0);
});

test('should notify webview when register', () => {
  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);
  localRepositories.register({ path: 'random', sourcePath: 'random', labels: { 'recipe-id': 'random' } });
  expect(rpcExtensionMock.fire).toHaveBeenNthCalledWith(1, MSG_LOCAL_REPOSITORY_UPDATE, [
    { path: 'random', sourcePath: 'random', labels: { 'recipe-id': 'random' } },
  ]);
});

test('should notify webview when unregister', async () => {
  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);
  vi.spyOn(fs.promises, 'rm').mockResolvedValue();
  localRepositories.register({ path: 'random', sourcePath: 'random', labels: { 'recipe-id': 'random' } });
  await localRepositories.deleteLocalRepository('random');

  expect(rpcExtensionMock.fire).toHaveBeenLastCalledWith(MSG_LOCAL_REPOSITORY_UPDATE, []);
});

test('should register localRepo if it find the folder of the recipe', () => {
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.mocked(catalogManagerMock.getRecipes).mockReturnValue([
    {
      id: 'recipe',
    } as unknown as Recipe,
  ]);

  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);

  const registerMock = vi.spyOn(localRepositories, 'register');
  localRepositories.init();

  const folder = path.join('/appUserDirectory', 'recipe');
  expect(registerMock).toHaveBeenCalledWith({
    path: folder,
    sourcePath: folder,
    labels: { 'recipe-id': 'recipe' },
  });
});

test('should register localRepo when catalog get updated', () => {
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.mocked(catalogManagerMock.getRecipes).mockReturnValue([]);

  let listener: ((catalog: ApplicationCatalog) => void) | undefined = undefined;
  vi.mocked(catalogManagerMock.onUpdate).mockImplementation((fn: (catalog: ApplicationCatalog) => void) => {
    listener = fn;
    return { dispose: vi.fn() };
  });

  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);

  const registerMock = vi.spyOn(localRepositories, 'register');
  localRepositories.init();

  const folder = path.join('/appUserDirectory', 'recipe');
  expect(registerMock).not.toHaveBeenCalled();
  expect(listener).toBeDefined();
  if (!listener) throw new Error('undefined listener');

  (listener as (catalog: ApplicationCatalog) => void)({
    recipes: [
      {
        id: 'recipe',
      } as unknown as Recipe,
    ],
    models: [],
    categories: [],
  });

  expect(registerMock).toHaveBeenCalledWith({
    path: folder,
    sourcePath: folder,
    labels: { 'recipe-id': 'recipe' },
  });
});

test('should NOT register localRepo if it does not find the folder of the recipe', () => {
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.mocked(catalogManagerMock.getRecipes).mockReturnValue([
    {
      id: 'recipe',
    } as unknown as Recipe,
  ]);

  const localRepositories = new LocalRepositoryRegistry(rpcExtensionMock, '/appUserDirectory', catalogManagerMock);
  const registerMock = vi.spyOn(localRepositories, 'register');
  localRepositories.init();
  expect(registerMock).not.toHaveBeenCalled();
});
