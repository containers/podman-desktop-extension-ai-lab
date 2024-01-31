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
import type { ExtensionContext } from '@podman-desktop/api';

import * as fs from 'node:fs';

vi.mock('./managers/modelsManager');

const mockedExtensionContext = {
  subscriptions: [],
} as unknown as ExtensionContext;

const studio = new Studio(mockedExtensionContext);

const mocks = vi.hoisted(() => ({
  listContainers: vi.fn(),
  getContainerConnections: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    Uri: class {
      static joinPath = () => ({ fsPath: '.' });
    },
    window: {
      createWebviewPanel: () => ({
        webview: {
          html: '',
          onDidReceiveMessage: vi.fn(),
          postMessage: vi.fn(),
        },
      }),
    },
    containerEngine: {
      onEvent: vi.fn(),
      listContainers: mocks.listContainers,
    },
    provider: {
      onDidRegisterContainerConnection: vi.fn(),
      getContainerConnections: mocks.getContainerConnections,
    },
  };
});

/// mock console.log
const originalConsoleLog = console.log;
const consoleLogMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  console.log = consoleLogMock;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

test('check activate ', async () => {
  mocks.listContainers.mockReturnValue([]);
  mocks.getContainerConnections.mockReturnValue([]);
  vi.spyOn(fs.promises, 'readFile').mockImplementation(() => {
    return Promise.resolve('<html></html>');
  });
  await studio.activate();

  // expect the activate method to be called on the studio class
  expect(consoleLogMock).toBeCalledWith('starting studio extension');
});

test('check deactivate ', async () => {
  await studio.deactivate();

  // expect the deactivate method to be called on the studio class
  expect(consoleLogMock).toBeCalledWith('stopping studio extension');
});
