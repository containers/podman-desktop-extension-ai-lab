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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Studio } from './studio';
import { type ExtensionContext, EventEmitter, version } from '@podman-desktop/api';

import * as fs from 'node:fs';

vi.mock('./managers/modelsManager');

const mockedExtensionContext = {
  subscriptions: [],
} as unknown as ExtensionContext;

const studio = new Studio(mockedExtensionContext);

const mocks = vi.hoisted(() => ({
  listContainers: vi.fn(),
  getContainerConnections: vi.fn(),
  postMessage: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    version: '1.8.0',
    fs: {
      createFileSystemWatcher: vi.fn(),
    },
    EventEmitter: vi.fn(),
    Uri: class {
      static joinPath = () => ({ fsPath: '.' });
    },
    window: {
      createWebviewPanel: () => ({
        webview: {
          html: '',
          onDidReceiveMessage: vi.fn(),
          postMessage: mocks.postMessage,
        },
        onDidChangeViewState: vi.fn(),
      }),
    },
    env: {
      createTelemetryLogger: () => ({
        logUsage: vi.fn(),
        logError: mocks.logErrorMock,
      }),
    },
    containerEngine: {
      onEvent: vi.fn(),
      listContainers: mocks.listContainers,
    },
    provider: {
      onDidRegisterContainerConnection: vi.fn(),
      onDidUpdateContainerConnection: vi.fn(),
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
const consoleLogMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  console.log = consoleLogMock;

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn(),
    fire: vi.fn(),
  } as unknown as EventEmitter<unknown>);

  mocks.postMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  console.log = originalConsoleLog;
});

test('check activate', async () => {
  expect(version).toBe('1.8.0');
  mocks.listContainers.mockReturnValue([]);
  mocks.getContainerConnections.mockReturnValue([]);
  vi.spyOn(fs.promises, 'readFile').mockImplementation(() => {
    return Promise.resolve('<html></html>');
  });
  await studio.activate();

  // expect the activate method to be called on the studio class
  expect(consoleLogMock).toBeCalledWith('starting AI Lab extension');
});

test('check activate incompatible', async () => {
  (version as string) = '1.7.0';
  await expect(async () => {
    await studio.activate();
  }).rejects.toThrowError('Extension is not compatible with PodmanDesktop version bellow 1.8.');

  // expect the activate method to be called on the studio class
  expect(mocks.logErrorMock).toBeCalledWith('start.incompatible', {
    version: '1.7.0',
    message: 'error activating extension on version bellow 1.8.0',
  });
});

test('check deactivate ', async () => {
  await studio.deactivate();

  // expect the deactivate method to be called on the studio class
  expect(consoleLogMock).toBeCalledWith('stopping AI Lab extension');
});
