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

import { expect, test, vi, beforeEach, afterEach, describe } from 'vitest';
import OpenAI from 'openai';
import { PlaygroundV2Manager } from './playgroundV2Manager';
import type { TelemetryLogger, Webview } from '@podman-desktop/api';
import type { InferenceServer } from '@shared/src/models/IInference';
import type { InferenceManager } from './inference/inferenceManager';
import { Messages } from '@shared/Messages';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { TaskRegistry } from '../registries/TaskRegistry';
import type { Task, TaskState } from '@shared/src/models/ITask';
import type { ChatMessage, ErrorMessage } from '@shared/src/models/IPlaygroundMessage';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';

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

const taskRegistryMock = {
  createTask: vi.fn(),
  getTasksByLabels: vi.fn(),
  updateTask: vi.fn(),
} as unknown as TaskRegistry;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const cancellationTokenRegistryMock = {
  createCancellationTokenSource: vi.fn(),
  delete: vi.fn(),
} as unknown as CancellationTokenRegistry;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(true);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('manager should be properly initialized', () => {
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
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
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground('playground 1', { id: 'model1' } as ModelInfo, 'tracking-1');

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

  await expect(manager.submit(manager.getConversations()[0].id, 'dummyUserInput')).rejects.toThrowError(
    'Inference server is not running.',
  );
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
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground('p1', { id: 'model1' } as ModelInfo, 'tracking-1');
  const playgroundId = manager.getConversations()[0].id;
  await expect(manager.submit(playgroundId, 'dummyUserInput')).rejects.toThrowError(
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
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  expect(manager.getConversations().length).toBe(0);
  await manager.createPlayground('playground 1', { id: 'model-1' } as ModelInfo, 'tracking-1');

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

  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo, 'tracking-1');

  const date = new Date(2000, 1, 1, 13);
  vi.setSystemTime(date);

  const playgrounds = manager.getConversations();
  await manager.submit(playgrounds[0].id, 'dummyUserInput');

  // Wait for assistant message to be completed
  await vi.waitFor(() => {
    expect((manager.getConversations()[0].messages[1] as ChatMessage).content).toBeDefined();
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

test('submit should send options', async () => {
  vi.mocked(cancellationTokenRegistryMock.createCancellationTokenSource).mockReturnValue(55);

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

  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo, 'tracking-1');

  const playgrounds = manager.getConversations();
  const cancellationId = await manager.submit(playgrounds[0].id, 'dummyUserInput', {
    temperature: 0.123,
    max_tokens: 45,
    top_p: 0.345,
    stream_options: { include_usage: true },
  });
  expect(cancellationId).toBe(55);

  const messages: unknown[] = [
    {
      content: 'dummyUserInput',
      id: expect.any(String),
      role: 'user',
      timestamp: expect.any(Number),
      options: {
        temperature: 0.123,
        max_tokens: 45,
        top_p: 0.345,
        stream_options: { include_usage: true },
      },
    },
  ];
  expect(createMock).toHaveBeenCalledWith(
    {
      messages,
      model: 'dummyModelFile',
      stream: true,
      temperature: 0.123,
      max_tokens: 45,
      top_p: 0.345,
      stream_options: { include_usage: true },
    },
    {
      signal: expect.anything(),
    },
  );
  // at the end the token must be deleted once the request is complete
  await vi.waitFor(() => {
    expect(cancellationTokenRegistryMock.delete).toHaveBeenCalledWith(55);
  });
});

test('error', async () => {
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
  const createMock = vi.fn().mockRejectedValue('Please reduce the length of the messages or completion.');
  vi.mocked(OpenAI).mockReturnValue({
    chat: {
      completions: {
        create: createMock,
      },
    },
  } as unknown as OpenAI);

  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo, 'tracking-1');

  const date = new Date(2000, 1, 1, 13);
  vi.setSystemTime(date);

  const playgrounds = manager.getConversations();
  await manager.submit(playgrounds[0].id, 'dummyUserInput');

  // Wait for error message
  await vi.waitFor(() => {
    expect((manager.getConversations()[0].messages[1] as ErrorMessage).error).toBeDefined();
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
    error: 'Please reduce the length of the messages or completion. Note: You should start a new playground.',
    id: expect.anything(),
    timestamp: expect.any(Number),
  });

  expect(webviewMock.postMessage).toHaveBeenLastCalledWith({
    id: Messages.MSG_CONVERSATIONS_UPDATE,
    body: conversations,
  });
});

test('creating a new playground should send new playground to frontend', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_CONVERSATIONS_UPDATE,
    body: [
      {
        id: expect.anything(),
        modelId: 'model-1',
        name: 'a name',
        messages: [],
      },
    ],
  });
});

test('creating a new playground with no name should send new playground to frontend with generated name', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    '',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_CONVERSATIONS_UPDATE,
    body: [
      {
        id: expect.anything(),
        modelId: 'model-1',
        name: 'playground 1',
        messages: [],
      },
    ],
  });
});

test('creating a new playground with no model served should start an inference server', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const createInferenceServerMock = vi.mocked(inferenceManagerMock.createInferenceServer);
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
  expect(createInferenceServerMock).toHaveBeenCalledWith({
    gpuLayers: expect.any(Number),
    image: undefined,
    providerId: undefined,
    inferenceProvider: undefined,
    labels: {
      trackingId: 'tracking-1',
    },
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
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
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
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
  expect(createInferenceServerMock).not.toHaveBeenCalled();
  expect(startInferenceServerMock).toHaveBeenCalledWith('container-1');
});

test('delete conversation should delete the conversation', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);

  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  expect(manager.getConversations().length).toBe(0);
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );

  const conversations = manager.getConversations();
  expect(conversations.length).toBe(1);
  manager.deleteConversation(conversations[0].id);
  expect(manager.getConversations().length).toBe(0);
  expect(webviewMock.postMessage).toHaveBeenCalled();
});

test('creating a new playground with an existing name should fail', async () => {
  vi.mocked(inferenceManagerMock.getServers).mockReturnValue([]);
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  await manager.createPlayground(
    'a name',
    {
      id: 'model-1',
      name: 'Model 1',
    } as unknown as ModelInfo,
    'tracking-1',
  );
  await expect(
    manager.createPlayground(
      'a name',
      {
        id: 'model-2',
        name: 'Model 2',
      } as unknown as ModelInfo,
      'tracking-2',
    ),
  ).rejects.toThrowError('a playground with the name a name already exists');
});

test('requestCreatePlayground should call createPlayground and createTask, then updateTask', async () => {
  vi.useRealTimers();
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  const createTaskMock = vi.mocked(taskRegistryMock).createTask;
  const updateTaskMock = vi.mocked(taskRegistryMock).updateTask;
  createTaskMock.mockImplementation((_name: string, _state: TaskState, labels?: { [id: string]: string }) => {
    return {
      labels,
    } as Task;
  });
  const createPlaygroundSpy = vi.spyOn(manager, 'createPlayground').mockResolvedValue('playground-1');

  const id = await manager.requestCreatePlayground('a name', { id: 'model-1' } as ModelInfo);

  expect(createPlaygroundSpy).toHaveBeenCalledWith('a name', { id: 'model-1' } as ModelInfo, expect.any(String));
  expect(createTaskMock).toHaveBeenCalledWith('Creating Playground environment', 'loading', {
    trackingId: id,
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(updateTaskMock).toHaveBeenCalledWith({
    labels: {
      trackingId: id,
      playgroundId: 'playground-1',
    },
    state: 'success',
  });
});

test('requestCreatePlayground should call createPlayground and createTask, then updateTask when createPlayground fails', async () => {
  vi.useRealTimers();
  const manager = new PlaygroundV2Manager(
    webviewMock,
    inferenceManagerMock,
    taskRegistryMock,
    telemetryMock,
    cancellationTokenRegistryMock,
  );
  const createTaskMock = vi.mocked(taskRegistryMock).createTask;
  const updateTaskMock = vi.mocked(taskRegistryMock).updateTask;
  const getTasksByLabelsMock = vi.mocked(taskRegistryMock).getTasksByLabels;
  createTaskMock.mockImplementation((_name: string, _state: TaskState, labels?: { [id: string]: string }) => {
    return {
      labels,
    } as Task;
  });
  const createPlaygroundSpy = vi.spyOn(manager, 'createPlayground').mockRejectedValue(new Error('an error'));

  const id = await manager.requestCreatePlayground('a name', { id: 'model-1' } as ModelInfo);

  expect(createPlaygroundSpy).toHaveBeenCalledWith('a name', { id: 'model-1' } as ModelInfo, expect.any(String));
  expect(createTaskMock).toHaveBeenCalledWith('Creating Playground environment', 'loading', {
    trackingId: id,
  });

  getTasksByLabelsMock.mockReturnValue([
    {
      labels: {
        trackingId: id,
      },
    } as unknown as Task,
  ]);

  await new Promise(resolve => setTimeout(resolve, 0));
  expect(updateTaskMock).toHaveBeenCalledWith({
    error: 'Something went wrong while trying to create a playground environment Error: an error.',
    labels: {
      trackingId: id,
    },
    state: 'error',
  });
});

describe('system prompt', () => {
  test('set system prompt on non existing conversation should throw an error', async () => {
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
    const manager = new PlaygroundV2Manager(
      webviewMock,
      inferenceManagerMock,
      taskRegistryMock,
      telemetryMock,
      cancellationTokenRegistryMock,
    );

    expect(() => {
      manager.setSystemPrompt('invalid', 'content');
    }).toThrowError('conversation with id invalid does not exist.');
  });

  test('set system prompt should throw an error if user already submit message', async () => {
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

    const manager = new PlaygroundV2Manager(
      webviewMock,
      inferenceManagerMock,
      taskRegistryMock,
      telemetryMock,
      cancellationTokenRegistryMock,
    );
    await manager.createPlayground('playground 1', { id: 'dummyModelId' } as ModelInfo, 'tracking-1');

    const date = new Date(2000, 1, 1, 13);
    vi.setSystemTime(date);

    const conversations = manager.getConversations();
    await manager.submit(conversations[0].id, 'dummyUserInput');

    // Wait for assistant message to be completed
    await vi.waitFor(() => {
      expect((manager.getConversations()[0].messages[1] as ChatMessage).content).toBeDefined();
    });

    expect(() => {
      manager.setSystemPrompt(manager.getConversations()[0].id, 'newSystemPrompt');
    }).toThrowError('Cannot change system prompt on started conversation.');
  });
});
