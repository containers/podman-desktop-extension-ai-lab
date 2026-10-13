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
import { type Webview, type WebviewPanel, type ExtensionContext, provider, window } from '@podman-desktop/api';
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

/// mock console.log
const originalConsoleLog = console.log;

beforeEach(() => {
  vi.clearAllMocks();
  console.log = mocks.consoleLogMock;
  console.warn = mocks.consoleWarnMock;

  vi.mocked(window.createWebviewPanel).mockReturnValue({
    onDidChangeViewState: vi.fn(),
    webview: {
      onDidReceiveMessage: vi.fn(),
      postMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as Webview,
  } as unknown as WebviewPanel);

  vi.mocked(CatalogManager).mockImplementation(function () {
    return {
      onUpdate: vi.fn(),
      init: vi.fn(),
      getRecipes: vi.fn().mockReturnValue([]),
    } as unknown as CatalogManager;
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

test('check activate', async () => {
  mocks.listContainers.mockReturnValue([]);
  vi.mocked(provider.getContainerConnections).mockReturnValue([]);
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
