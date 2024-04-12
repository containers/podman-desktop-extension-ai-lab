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

import { beforeEach, expect, test, vi, describe } from 'vitest';
import content from './tests/ai-test.json';
import type { ApplicationManager } from './managers/applicationManager';
import { StudioApiImpl } from './studio-api-impl';
import type { InferenceManager } from './managers/inference/inferenceManager';
import type { ProviderContainerConnection, TelemetryLogger, Webview } from '@podman-desktop/api';
import { window, EventEmitter, navigation } from '@podman-desktop/api';
import { CatalogManager } from './managers/catalogManager';
import type { ModelsManager } from './managers/modelsManager';
import { timeout } from './utils/utils';
import type { TaskRegistry } from './registries/TaskRegistry';
import { LocalRepositoryRegistry } from './registries/LocalRepositoryRegistry';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { PlaygroundV2Manager } from './managers/playgroundV2Manager';
import type { SnippetManager } from './managers/SnippetManager';
import type { ModelCheckerInfo, ModelInfo } from '@shared/src/models/IModelInfo';
import type { CancellationTokenRegistry } from './registries/CancellationTokenRegistry';
import path from 'node:path';
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';
import * as podman from './utils/podman';

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
  showWarningMessageMock: vi.fn(),
  deleteApplicationMock: vi.fn(),
  uriFileMock: vi.fn(),
  openExternalMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    window: {
      withProgress: mocks.withProgressMock,
      showWarningMessage: mocks.showWarningMessageMock,
      showErrorMessage: vi.fn(),
      showOpenDialog: vi.fn(),
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
    Uri: {
      file: mocks.uriFileMock,
    },
    env: {
      openExternal: mocks.openExternalMock,
    },
    navigation: {
      navigateToResources: vi.fn(),
      navigateToEditProviderContainerConnection: vi.fn(),
    },
  };
});

let studioApiImpl: StudioApiImpl;
let catalogManager: CatalogManager;
let localRepositoryRegistry: LocalRepositoryRegistry;

beforeEach(async () => {
  vi.resetAllMocks();

  const appUserDirectory = '.';

  // Creating CatalogManager
  catalogManager = new CatalogManager(
    {
      postMessage: vi.fn().mockResolvedValue(undefined),
      addLocalModelsToCatalog: vi.fn(),
    } as unknown as Webview,
    appUserDirectory,
  );

  localRepositoryRegistry = new LocalRepositoryRegistry(
    {
      postMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as Webview,
    appUserDirectory,
  );

  const telemetryMock = {
    logUsage: vi.fn(),
    logError: vi.fn(),
  } as unknown as TelemetryLogger;

  // Creating StudioApiImpl
  studioApiImpl = new StudioApiImpl(
    {
      deleteApplication: mocks.deleteApplicationMock,
    } as unknown as ApplicationManager,
    catalogManager,
    {} as ModelsManager,
    telemetryMock,
    localRepositoryRegistry,
    {} as unknown as TaskRegistry,
    {} as unknown as InferenceManager,
    {} as unknown as PlaygroundV2Manager,
    {} as unknown as SnippetManager,
    {} as unknown as CancellationTokenRegistry,
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

test('expect pull application to call the withProgress api method', async () => {
  vi.spyOn(catalogManager, 'getRecipes').mockReturnValue([
    {
      id: 'recipe 1',
    } as unknown as Recipe,
  ]);
  vi.spyOn(catalogManager, 'getModelById').mockReturnValue({
    id: 'model',
  } as unknown as ModelInfo);

  mocks.withProgressMock.mockResolvedValue(undefined);

  await studioApiImpl.pullApplication('recipe 1', 'model1');
  expect(mocks.withProgressMock).toHaveBeenCalledOnce();
});

test('requestRemoveApplication should ask confirmation', async () => {
  vi.spyOn(catalogManager, 'getRecipeById').mockReturnValue({
    name: 'Recipe 1',
  } as unknown as Recipe);
  mocks.showWarningMessageMock.mockResolvedValue('Confirm');
  await studioApiImpl.requestRemoveApplication('recipe-id-1', 'model-id-1');
  await timeout(0);
  expect(mocks.deleteApplicationMock).toHaveBeenCalled();
});

test('requestDeleteLocalRepository should ask confirmation', async () => {
  mocks.showWarningMessageMock.mockResolvedValue('Confirm');
  const deleteLocalRepositoryMock = vi.spyOn(localRepositoryRegistry, 'deleteLocalRepository').mockResolvedValue();
  await studioApiImpl.requestDeleteLocalRepository('path');
  await timeout(0);
  expect(deleteLocalRepositoryMock).toHaveBeenCalled();
});

test('if requestDeleteLocalRepository fails an errorMessage should show up', async () => {
  mocks.showWarningMessageMock.mockResolvedValue('Confirm');
  const deleteLocalRepositoryMock = vi
    .spyOn(localRepositoryRegistry, 'deleteLocalRepository')
    .mockRejectedValue('error deleting');
  const errorMessageMock = vi.spyOn(window, 'showErrorMessage').mockResolvedValue('');
  await studioApiImpl.requestDeleteLocalRepository('path');
  await timeout(0);
  expect(deleteLocalRepositoryMock).toHaveBeenCalled();
  expect(errorMessageMock).toBeCalledWith('Error deleting local path "path". Error: error deleting');
});

describe.each([{ os: 'windows' }, { os: 'linux' }, { os: 'macos' }])('verify openVSCode', ({ os }) => {
  test(`check openVSCode generates the correct URL on ${os}`, async () => {
    vi.mock('node:path');
    vi.spyOn(path, 'isAbsolute').mockReturnValue(true);
    vi.spyOn(path, 'normalize').mockImplementation((path: string) => {
      return path;
    });
    const folder = os === 'windows' ? 'C:\\\\Users\\\\podman-desktop\\\\work' : '/home/podman-desktop/work';

    mocks.uriFileMock.mockImplementation((path: string) => {
      return {
        path: path,
        with: (change?: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }) => {
          return {
            path: path,
            ...change,
          };
        },
      };
    });

    mocks.openExternalMock.mockResolvedValue(true);
    await studioApiImpl.openVSCode(folder);
    expect(mocks.openExternalMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^\//), authority: 'file', scheme: 'vscode' }),
    );
  });
});

test('openDialog should call podmanDesktopAPi showOpenDialog', async () => {
  const openDialogMock = vi.spyOn(window, 'showOpenDialog');
  await studioApiImpl.openDialog({
    title: 'title',
  });
  expect(openDialogMock).toBeCalledWith({
    title: 'title',
  });
});

test('importModels should call catalogManager', async () => {
  const addLocalModelsMock = vi
    .spyOn(catalogManager, 'addLocalModelsToCatalog')
    .mockImplementation((_models: LocalModelImportInfo[]) => Promise.resolve());
  const models: LocalModelImportInfo[] = [
    {
      name: 'name',
      path: 'path',
    },
    {
      name: 'name1',
      path: 'path1',
    },
  ];
  await studioApiImpl.importModels(models);
  expect(addLocalModelsMock).toBeCalledWith(models);
});

test('Expect checkInvalidModels to returns an empty array if all paths are valid', async () => {
  vi.mock('node:path');
  vi.spyOn(path, 'resolve').mockImplementation((path: string) => {
    return path;
  });
  vi.spyOn(path, 'join').mockImplementation((path1: string, path2: string) => `${path1}/${path2}`);
  vi.spyOn(studioApiImpl, 'getModelsInfo').mockResolvedValue([
    {
      id: 'model',
      file: {
        path: 'path1',
        file: 'file.gguf',
      },
    } as unknown as ModelInfo,
  ]);
  const result = await studioApiImpl.checkInvalidModels(['path/file.gguf']);
  expect(result).toStrictEqual([]);
});

test('Expect checkInvalidModels to returns an array with the invalid value', async () => {
  vi.mock('node:path');
  vi.spyOn(path, 'resolve').mockImplementation((path: string) => {
    return path;
  });
  vi.spyOn(path, 'join').mockImplementation((path1: string, path2: string) => `${path1}/${path2}`);
  vi.spyOn(studioApiImpl, 'getModelsInfo').mockResolvedValue([
    {
      id: 'model',
      file: {
        path: 'path1',
        file: 'file.gguf',
      },
    } as unknown as ModelInfo,
  ]);
  const result = await studioApiImpl.checkInvalidModels(['path/file.gguf', 'path1/file.gguf']);
  expect(result).toStrictEqual(['path1/file.gguf']);
});

test('Expect checkInvalidModels to returns an array with the invalid values', async () => {
  vi.mock('node:path');
  vi.spyOn(path, 'resolve').mockImplementation((path: string) => {
    return path;
  });
  vi.spyOn(path, 'join').mockImplementation((path1: string, path2: string) => `${path1}/${path2}`);
  vi.spyOn(studioApiImpl, 'getModelsInfo').mockResolvedValue([
    {
      id: 'model',
      file: {
        path: 'path',
        file: 'file.gguf',
      },
    } as unknown as ModelInfo,
    {
      id: 'model',
      file: {
        path: 'path2',
        file: 'file.gguf',
      },
    } as unknown as ModelInfo,
  ]);
  const result = await studioApiImpl.checkInvalidModels(['path/file.gguf', 'path1/file.gguf', 'path2/file.gguf']);
  expect(result).toStrictEqual(['path/file.gguf', 'path2/file.gguf']);
});

test('navigateToResources should call navigation.navigateToResources', async () => {
  const navigationSpy = vi.spyOn(navigation, 'navigateToResources');
  await studioApiImpl.navigateToResources();
  await timeout(0);
  expect(navigationSpy).toHaveBeenCalled();
});

test('navigateToEditConnectionProvider should call navigation.navigateToEditProviderContainerConnection', async () => {
  const connection: ProviderContainerConnection = {
    providerId: 'id',
    connection: {
      endpoint: {
        socketPath: '/path',
      },
      name: 'name',
      type: 'podman',
      status: vi.fn(),
    },
  };
  vi.spyOn(podman, 'getPodmanConnection').mockReturnValue(connection);
  const navigationSpy = vi.spyOn(navigation, 'navigateToEditProviderContainerConnection');
  await studioApiImpl.navigateToEditConnectionProvider('connection');
  await timeout(0);
  expect(navigationSpy).toHaveBeenCalledWith(connection);
});

test('checkContainerConnectionStatusAndResources should call podman.checkContainerConnectionStatusAndResources', async () => {
  const checkContainerSpy = vi.spyOn(podman, 'checkContainerConnectionStatusAndResources');
  const modelInfo: ModelCheckerInfo = {
    memoryNeeded: 1000,
    context: 'inference',
  };
  await studioApiImpl.checkContainerConnectionStatusAndResources(modelInfo);
  await timeout(0);
  expect(checkContainerSpy).toHaveBeenCalledWith(modelInfo);
});
