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

import { beforeEach, expect, test, vi } from 'vitest';
import content from './ai-test.json';
import userContent from './ai-user-test.json';
import type { ApplicationManager } from './managers/applicationManager';
import { StudioApiImpl } from './studio-api-impl';
import type { PlayGroundManager } from './managers/playground';
import type { TelemetryLogger, Webview } from '@podman-desktop/api';
import { CatalogManager } from './managers/catalogManager';
import type { ModelsManager } from './managers/modelsManager';

import * as fs from 'node:fs';
import { timeout } from './utils/utils';
import type { TaskRegistry } from './registries/TaskRegistry';
import type { LocalRepositoryRegistry } from './registries/LocalRepositoryRegistry';

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
  showWarningMessageMock: vi.fn(),
  deleteApplicationMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    window: {
      withProgress: mocks.withProgressMock,
      showWarningMessage: mocks.showWarningMessageMock,
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

let studioApiImpl: StudioApiImpl;
let catalogManager;

beforeEach(async () => {
  const appUserDirectory = '.';

  // Creating CatalogManager
  catalogManager = new CatalogManager(appUserDirectory, {
    postMessage: vi.fn(),
  } as unknown as Webview);

  // Creating StudioApiImpl
  studioApiImpl = new StudioApiImpl(
    {
      deleteApplication: mocks.deleteApplicationMock,
    } as unknown as ApplicationManager,
    {} as unknown as PlayGroundManager,
    catalogManager,
    {} as unknown as ModelsManager,
    {} as TelemetryLogger,
    {} as LocalRepositoryRegistry,
    {} as unknown as TaskRegistry,
  );
  vi.resetAllMocks();
  vi.mock('node:fs');
});

test('expect pull application to call the withProgress api method', async () => {
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(userContent));

  mocks.withProgressMock.mockResolvedValue(undefined);

  await catalogManager.loadCatalog();
  await studioApiImpl.pullApplication('recipe 1', 'model1');
  expect(mocks.withProgressMock).toHaveBeenCalledOnce();
});

test('requestRemoveApplication should ask confirmation', async () => {
  vi.spyOn(catalogManager, 'getRecipeById').mockReturnValue({
    name: 'Recipe 1',
  });
  mocks.showWarningMessageMock.mockResolvedValue('Confirm');
  await studioApiImpl.requestRemoveApplication('recipe-id-1', 'model-id-1');
  await timeout(0);
  expect(mocks.deleteApplicationMock).toHaveBeenCalled();
});
