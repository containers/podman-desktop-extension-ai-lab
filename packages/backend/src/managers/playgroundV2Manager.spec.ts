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

test('submit should throw an error if the server is stopped', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
      status: 'running',
      models: [
        {
          id: 'model1',
        },
      ],
    } as unknown as InferenceServer,
  ]);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('playground 1', { id: 'model1' } as ModelInfo);

  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
      status: 'stopped',
      models: [
        {
          id: 'model1',
        },
      ],
    } as unknown as InferenceServer,
  ]);

  await expect(manager.submit('0', 'dummyUserInput', '')).rejects.toThrowError('Inference server is not running.');
});

test('submit should throw an error if the server is unhealthy', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
      status: 'running',
      health: {
        Status: 'unhealthy',
      },
      models: [
        {
          id: 'model1',
        },
      ],
    } as unknown as InferenceServer,
  ]);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('p1', { id: 'model1' } as ModelInfo);
  const playgroundId = manager.getPlaygrounds()[0].id;
  await expect(manager.submit(playgroundId, 'dummyUserInput', '')).rejects.toThrowError(
    'Inference server is not healthy, currently status: unhealthy.',
  );
});

test('create playground should create conversation.', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
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
    } as unknown as InferenceServer,
  ]);
  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  expect(manager.getConversations().length).toBe(0);
  await manager.createPlayground('playground 1', { id: 'model-1' } as ModelInfo);

  const conversations = manager.getConversations();
  expect(conversations.length).toBe(1);
});

test('valid submit should create IPlaygroundMessage and notify the webview', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
    {
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
    } as unknown as InferenceServer,
  ]);
  const createMock = vi.fn().mockResolvedValue([]);
  vi.mocked(OpenAI).mockReturnValue({
    chat: {
      completions: {
        create: createMock,
      },
    },
  } as unknown as OpenAI);

  const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
  await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo);

  const date = new Date(2000, 1, 1, 13);
  vi.setSystemTime(date);

  const playgrounds = manager.getPlaygrounds();
  await manager.submit(playgrounds[0].id, 'dummyUserInput', '');

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
    timestamp: expect.any(Number),
  });
  expect(conversations[0].messages[1]).toStrictEqual({
    choices: undefined,
    completed: expect.any(Number),
    content: '',
    id: expect.anything(),
    role: 'assistant',
    timestamp: expect.any(Number),
  });

  expect(webviewMock.postMessage).toHaveBeenLastCalledWith({
    id: Messages.MSG_CONVERSATIONS_UPDATE,
    body: conversations,
  });
});

test.each(['', 'my system prompt'])(
  'valid submit should send a message with system prompt if non empty, system prompt is "%s"}',
  async (systemPrompt: string) => {
    vi.mocked(inferenceManagerMock.getServers).mockReturnValue([
      {
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
      } as unknown as InferenceServer,
    ]);
    const createMock = vi.fn().mockResolvedValue([]);
    vi.mocked(OpenAI).mockReturnValue({
      chat: {
        completions: {
          create: createMock,
        },
      },
    } as unknown as OpenAI);

    const manager = new PlaygroundV2Manager(webviewMock, inferenceManagerMock);
    await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo);

    const playgrounds = manager.getPlaygrounds();
    await manager.submit(playgrounds[0].id, 'dummyUserInput', systemPrompt);

    const messages: unknown[] = [
      {
        content: 'dummyUserInput',
        id: expect.any(String),
        role: 'user',
        timestamp: expect.any(Number),
      },
    ];
    if (systemPrompt) {
      messages.push({
        content: 'my system prompt',
        role: 'system',
      });
    }
    expect(createMock).toHaveBeenCalledWith({
      messages,
      model: 'dummyModelFile',
      stream: true,
    });
  },
);

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
    image: 'quay.io/bootsy/playground:v0',
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
