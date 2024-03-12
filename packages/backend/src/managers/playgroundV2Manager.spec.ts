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

import { expect, test, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { PlaygroundV2Manager } from './playgroundV2Manager';
import type { Webview } from '@podman-desktop/api';
import type { InferenceServer } from '@shared/src/models/IInference';
import type { InferenceManager } from './inference/inferenceManager';
import { Messages } from '@shared/Messages';

vi.mock('openai', () => ({
  default: vi.fn(),
}));

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

const inferenceManagerMock = {
  get: vi.fn(),
} as unknown as InferenceManager;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);
});

test('manager should be properly initialized', () => {
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  expect(manager.getAll().length).toBe(0);
});

test('submit should throw an error is the server is stopped', async () => {
  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'stopped',
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(manager.submit('dummyContainerId', 'dummyModelId', 'dummyUserInput')).rejects.toThrowError(
    'Inference server is not running.',
  );
});

test('submit should throw an error is the server is unhealthy', async () => {
  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'running',
    health: {
      Status: 'unhealthy',
    },
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(manager.submit('dummyContainerId', 'dummyModelId', 'dummyUserInput')).rejects.toThrowError(
    'Inference server is not healthy, currently status: unhealthy.',
  );
});

test('submit should throw an error is the model id provided does not exist.', async () => {
  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'running',
    health: {
      Status: 'healthy',
    },
    models: [
      {
        id: 'dummyModelId',
      },
    ],
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(manager.submit('dummyContainerId', 'invalidModelId', 'dummyUserInput')).rejects.toThrowError(
    "modelId 'invalidModelId' is not available on the inference server, valid model ids are: dummyModelId.",
  );
});

test('valid submit should create IPlaygroundMessage and notify the webview', async () => {
  const createMock = vi.fn().mockResolvedValue([]);
  vi.mocked(OpenAI).mockReturnValue({
    chat: {
      completions: {
        create: createMock,
      },
    },
  } as unknown as OpenAI);

  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'running',
    health: {
      Status: 'healthy',
    },
    models: [
      {
        id: 'dummyModelId',
        file: {
          file: 'dummyModelFile',
        },
      },
    ],
    connection: {
      port: 8888,
    },
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.submit('dummyContainerId', 'dummyModelId', 'dummyUserInput');

  expect(webviewMock.postMessage).toHaveBeenNthCalledWith(1, {
    id: Messages.MSG_PLAYGROUNDS_MESSAGES_UPDATE,
    body: [
      {
        choices: [],
        completed: false,
        id: expect.anything(),
        timestamp: expect.anything(),
        userInput: 'dummyUserInput',
      },
    ],
  });
  expect(manager.getAll().length).toBe(1);
});
