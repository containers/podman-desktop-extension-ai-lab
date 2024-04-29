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

import { beforeEach, expect, test, vi } from 'vitest';
import { UpdateManager } from './UpdateManager';
import type { Webview } from '@podman-desktop/api';
import type { ModelsManager } from '../modelsManager';
import https from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import fs, { promises } from 'node:fs';

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

const modelsManagerMock = {
  getModelsInfo: vi.fn(),
} as unknown as ModelsManager;

vi.mock('node:https', () => {
  return {
    default: {
      get: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

test('non-initialized should not have any update available', () => {
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  expect(updater.getAll().length).toBe(0);
});

test('init call should get all the models from models manager', async () => {
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([]);
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  updater.init();

  return vi.waitFor(() => {
    expect(modelsManagerMock.getModelsInfo).toHaveBeenCalledOnce();
  });
});

test('init call should HEAD model url to get ETag', async () => {
  // state that the etag file exists
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);

  // mock read etag
  vi.spyOn(promises, 'readFile').mockResolvedValue('old-etag');

  // mock models info
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      url: 'dummy-url',
      file: {
        path: 'dummy-path',
        file: 'dummy-file',
      },
      id: 'dummy-model-id',
    } as unknown as ModelInfo,
  ]);

  // Get the https callback
  let onResponse: ((msg: IncomingMessage) => void) | undefined;
  vi.mocked(https.get).mockImplementation((url, options, callback) => {
    onResponse = callback;
    expect(url).toBe('dummy-url');
    expect(options.method).toBe('HEAD');
    return {} as unknown as ClientRequest;
  });

  // create & initialize the update manager
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  updater.init();

  // wait for the callback to be defined
  await vi.waitFor(() => {
    expect(onResponse).toBeDefined();
  });

  // let typescript know it is defined
  if (!onResponse) throw new Error('undefined onResponse');

  onResponse({ headers: { etag: 'new-etag' } } as unknown as IncomingMessage);

  await vi.waitFor(() => {
    expect(updater.getAll().length).toBe(1);
  });
});

test('init call should ignore request without etag header', async () => {
  // state that the etag file exists
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);

  // mock read etag
  vi.spyOn(promises, 'readFile').mockResolvedValue('old-etag');

  // mock models info
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      url: 'dummy-url-without-etag',
      file: {
        path: 'dummy-path',
        file: 'dummy-file',
      },
      id: 'dummy-model-id-1',
    } as unknown as ModelInfo,
    {
      url: 'dummy-url-with-etag',
      file: {
        path: 'dummy-path',
        file: 'dummy-file',
      },
      id: 'dummy-model-id-2',
    } as unknown as ModelInfo,
  ]);

  // Mock the https callback
  vi.mocked(https.get).mockImplementation((url, options, callback) => {
    if (url === 'dummy-url-with-etag') {
      callback?.({ headers: { etag: 'new-etag' } } as unknown as IncomingMessage);
    } else {
      callback?.({ headers: {} } as unknown as IncomingMessage);
    }
    return {} as unknown as ClientRequest;
  });

  // create & initialize the update manager
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  updater.init();

  await vi.waitFor(() => {
    const updates = updater.getAll();
    expect(updates.length).toBe(1);
    expect(updates[0].modelsId).toBe('dummy-model-id-2');
  });
});

test('models info without file should not be checked', async () => {
  // state that the etag file exists
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);

  // mock read etag
  vi.spyOn(promises, 'readFile').mockResolvedValue('old-etag');

  // mock models info
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      url: 'dummy-url-without-file',
      id: 'dummy-model-id-1',
    } as unknown as ModelInfo,
    {
      url: 'dummy-url-with-etag',
      file: {
        path: 'dummy-path',
        file: 'dummy-file',
      },
      id: 'dummy-model-id-2',
    } as unknown as ModelInfo,
  ]);

  // Mock the https callback
  vi.mocked(https.get).mockImplementation((url, options, callback) => {
    expect(url).not.toBe('dummy-url-without-file');
    if (url === 'dummy-url-with-etag') {
      callback?.({ headers: { etag: 'new-etag' } } as unknown as IncomingMessage);
    }
    return {} as unknown as ClientRequest;
  });

  // create & initialize the update manager
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  updater.init();

  await vi.waitFor(() => {
    const updates = updater.getAll();
    expect(updates.length).toBe(1);
    expect(updates[0].modelsId).toBe('dummy-model-id-2');
  });
});

test('models info without local etag should not be checked', async () => {
  // state that the etag file exists
  vi.spyOn(fs, 'existsSync').mockImplementation(path => {
    return path.toString().includes('dummy-path-with-etag');
  });

  // mock read etag
  vi.spyOn(promises, 'readFile').mockResolvedValue('old-etag');

  // mock models info
  vi.mocked(modelsManagerMock.getModelsInfo).mockReturnValue([
    {
      url: 'dummy-url-without-local-etag',
      file: {
        path: 'dummy-path-without-etag',
        file: 'dummy-file',
      },
      id: 'dummy-model-id-1',
    } as unknown as ModelInfo,
    {
      url: 'dummy-url-with-local-etag',
      file: {
        path: 'dummy-path-with-etag',
        file: 'dummy-file',
      },
      id: 'dummy-model-id-2',
    } as unknown as ModelInfo,
  ]);

  // Mock the https callback
  vi.mocked(https.get).mockImplementation((url, options, callback) => {
    expect(url).not.toBe('dummy-url-without-local-etag');
    if (url === 'dummy-url-with-local-etag') {
      callback?.({ headers: { etag: 'new-etag' } } as unknown as IncomingMessage);
    }
    return {} as unknown as ClientRequest;
  });

  // create & initialize the update manager
  const updater = new UpdateManager(webviewMock, modelsManagerMock);
  updater.init();

  await vi.waitFor(() => {
    const updates = updater.getAll();
    expect(updates.length).toBe(1);
    expect(updates[0].modelsId).toBe('dummy-model-id-2');
  });
});
