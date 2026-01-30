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

import { afterEach, beforeEach, expect, test, vi, type MockInstance } from 'vitest';
import { Studio } from './studio';
import { type ExtensionContext, EventEmitter } from '@podman-desktop/api';
import { CatalogManager } from './managers/catalogManager';

import * as fs from 'node:fs';

vi.mock('./managers/modelsManager');
vi.mock('./managers/catalogManager');

const mockedExtensionContext = {
  subscriptions: [],
  storagePath: 'dummy-storage-path',
} as unknown as ExtensionContext;

const studio = new Studio(mockedExtensionContext);

const mocks = vi.hoisted(() => ({
  listContainers: vi.fn(),
  getContainerConnections: vi.fn(),
  postMessage: vi.fn(),
  logErrorMock: vi.fn(),
  consoleWarnMock: vi.fn(),
  consoleLogMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    configuration: {
      getConfiguration: (): unknown => ({
        get: vi.fn(),
      }),
      onDidChangeConfiguration: vi.fn(),
    },
    fs: {
      createFileSystemWatcher: (): unknown => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
    EventEmitter: vi.fn(),
    Uri: class {
      static readonly joinPath = (): unknown => ({ fsPath: '.' });
    },
    window: {
      createWebviewPanel: (): unknown => ({
        webview: {
          html: '',
          onDidReceiveMessage: vi.fn(),
          postMessage: mocks.postMessage,
        },
        onDidChangeViewState: vi.fn(),
      }),
      createStatusBarItem: (): unknown => ({
        show: vi.fn(),
      }),
    },
    env: {
      createTelemetryLogger: (): unknown => ({
        logUsage: vi.fn(),
        logError: mocks.logErrorMock,
      }),
    },
    containerEngine: {
      onEvent: vi.fn(),
      listContainers: mocks.listContainers,
    },
    navigation: {
      register: vi.fn(),
    },
    provider: {
      onDidRegisterContainerConnection: vi.fn(),
      onDidUpdateContainerConnection: vi.fn(),
      onDidUnregisterContainerConnection: vi.fn(),
      onDidUpdateProvider: vi.fn(),
      getContainerConnections: mocks.getContainerConnections,
    },
    commands: {
      registerCommand: vi.fn(),
    },
    Disposable: {
      create: vi.fn(),
    },
  };
});

/// mock console.log
const originalConsoleLog = console.log;

beforeEach(() => {
  vi.clearAllMocks();
  console.log = mocks.consoleLogMock;
  console.warn = mocks.consoleWarnMock;

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn(),
    fire: vi.fn(),
  } as unknown as EventEmitter<unknown>);

  mocks.postMessage.mockResolvedValue(undefined);

  vi.mocked(CatalogManager).mockReturnValue({
    onUpdate: vi.fn(),
    init: vi.fn(),
    getRecipes: vi.fn().mockReturnValue([]),
  } as unknown as CatalogManager);
});

afterEach(() => {
  console.log = originalConsoleLog;
});

test('check activate', async () => {
  mocks.listContainers.mockReturnValue([]);
  mocks.getContainerConnections.mockReturnValue([]);
  (vi.spyOn(fs.promises, 'readFile') as unknown as MockInstance<() => Promise<string>>).mockImplementation(() => {
    return Promise.resolve('<html></html>');
  });
  await studio.activate();

  // expect the activate method to be called on the studio class
  expect(mocks.consoleLogMock).toBeCalledWith('starting AI Lab extension');
});

test('check deactivate ', async () => {
  await studio.deactivate();

  // expect the deactivate method to be called on the studio class
  expect(mocks.consoleLogMock).toBeCalledWith('stopping AI Lab extension');
});
