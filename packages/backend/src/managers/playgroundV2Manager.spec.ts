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

import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import { PlaygroundV2Manager } from './playgroundV2Manager';
import type { Webview } from '@podman-desktop/api';
import type { InferenceServer } from '@shared/src/models/IInference';
import type { InferenceManager } from './inference/inferenceManager';
import { Messages } from '@shared/Messages';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { INFERENCE_SERVER_IMAGE } from '../utils/inferenceUtils';

vi.mock('openai', () => ({
  default: vi.fn(),
}));

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

const inferenceManagerMock = {
  get: vi.fn(),
  getServers: vi.fn(),
  createInferenceServer: vi.fn(),
  startInferenceServer: vi.fn(),
} as unknown as InferenceManager;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('manager should be properly initialized', () => {
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  expect(manager.getConversations().length).toBe(0);
});

test('submit should throw an error is the server is stopped', async () => {
  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'stopped',
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(
    manager.submit('dummyContainerId', 'dummyModelId', 'dummyConversationId', 'dummyUserInput'),
  ).rejects.toThrowError('Inference server is not running.');
});

test('submit should throw an error is the server is unhealthy', async () => {
  vi.mocked(inferenceManagerMock.get).mockReturnValue({
    status: 'running',
    health: {
      Status: 'unhealthy',
    },
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(
    manager.submit('dummyContainerId', 'dummyModelId', 'dummyConversationId', 'dummyUserInput'),
  ).rejects.toThrowError('Inference server is not healthy, currently status: unhealthy.');
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
  await expect(
    manager.submit('dummyContainerId', 'invalidModelId', 'dummyConversationId', 'dummyUserInput'),
  ).rejects.toThrowError(
    `modelId 'invalidModelId' is not available on the inference server, valid model ids are: dummyModelId.`,
  );
});

test('submit should throw an error is the conversation id provided does not exist.', async () => {
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
  } as unknown as InferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await expect(
    manager.submit('dummyContainerId', 'dummyModelId', 'dummyConversationId', 'dummyUserInput'),
  ).rejects.toThrowError(`conversation with id dummyConversationId does not exist.`);
});

test('create conversation should create conversation.', async () => {
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  expect(manager.getConversations().length).toBe(0);
  const conversationId = manager.createConversation();

  const conversations = manager.getConversations();
  expect(conversations.length).toBe(1);
  expect(conversations[0].id).toBe(conversationId);
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
  const conversationId = manager.createConversation();

  const date = new Date(2000, 1, 1, 13);
  vi.setSystemTime(date);

  await manager.submit('dummyContainerId', 'dummyModelId', conversationId, 'dummyUserInput');

  // Wait for assistant message to be completed
  await vi.waitFor(() => {
    expect(manager.getConversations()[0].messages[1].content).toBeDefined();
  });

  const conversations = manager.getConversations();

  expect(conversations.length).toBe(1);
  expect(conversations[0].messages.length).toBe(2);
  expect(conversations[0].messages[0]).toStrictEqual({
    content: 'dummyUserInput',
    id: expect.anything(),
    options: undefined,
    role: 'user',
    timestamp: date.getTime(),
  });
  expect(conversations[0].messages[1]).toStrictEqual({
    choices: undefined,
    completed: true,
    content: '',
    id: expect.anything(),
    role: 'assistant',
    timestamp: date.getTime(),
  });

  expect(webviewMock.postMessage).toHaveBeenLastCalledWith({
    id: Messages.MSG_CONVERSATIONS_UPDATE,
    body: conversations,
  });
});

test('creating a new playground should send new playground to frontend', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('a name', {
    id: 'model-1',
    name: 'Model 1',
  } as unknown as ModelInfo);
  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_PLAYGROUNDS_V2_UPDATE,
    body: [
      {
        id: '0',
        modelId: 'model-1',
        name: 'a name',
      },
    ],
  });
});

test('creating a new playground with no name should send new playground to frontend with generated name', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('', {
    id: 'model-1',
    name: 'Model 1',
  } as unknown as ModelInfo);
  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_PLAYGROUNDS_V2_UPDATE,
    body: [
      {
        id: '0',
        modelId: 'model-1',
        name: 'playground 1',
      },
    ],
  });
});

test('creating a new playground with no model served should start an inference server', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const createInferenceServerMock = vi.mocked(inferenceManagerMock.createInferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('a name', {
    id: 'model-1',
    name: 'Model 1',
  } as unknown as ModelInfo);
  expect(createInferenceServerMock).toHaveBeenCalledWith({
    image: INFERENCE_SERVER_IMAGE,
    labels: {},
    modelsInfo: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ],
    port: expect.anything(),
  });
});

test('creating a new playground with the model already served should not start an inference server', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
      models: [
        {
          id: 'model-1',
        },
      ],
    },
  ] as InferenceServer[]);
  const createInferenceServerMock = vi.mocked(inferenceManagerMock.createInferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('a name', {
    id: 'model-1',
    name: 'Model 1',
  } as unknown as ModelInfo);
  expect(createInferenceServerMock).not.toHaveBeenCalled();
});

test('creating a new playground with the model server stopped should start the inference server', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
      models: [
        {
          id: 'model-1',
        },
      ],
      status: 'stopped',
      container: {
        containerId: 'container-1',
      },
    },
  ] as InferenceServer[]);
  const createInferenceServerMock = vi.mocked(inferenceManagerMock.createInferenceServer);
  const startInferenceServerMock = vi.mocked(inferenceManagerMock.startInferenceServer);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('a name', {
    id: 'model-1',
    name: 'Model 1',
  } as unknown as ModelInfo);
  expect(createInferenceServerMock).not.toHaveBeenCalled();
  expect(startInferenceServerMock).toHaveBeenCalledWith('container-1');
});
