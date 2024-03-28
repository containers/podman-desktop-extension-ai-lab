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

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';
import Playground from './Playground.svelte';
import { studioClient } from '../utils/client';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { fireEvent } from '@testing-library/dom';
import type {
  AssistantChat,
  Conversation,
  PendingChat,
  SystemPrompt,
  UserChat,
} from '@shared/src/models/IPlaygroundMessage';
import * as conversationsStore from '/@/stores/conversations';
import * as inferenceServersStore from '/@/stores/inferenceServers';
import { readable, writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import type { InferenceServer } from '@shared/src/models/IInference';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: vi.fn(),
      getPlaygroundsV2: vi.fn(),
      submitPlaygroundMessage: vi.fn(),
    },
    rpcBrowser: {
      subscribe: () => {
        return {
          unsubscribe: () => {},
        };
      },
    },
  };
});

vi.mock('/@/stores/conversations', async () => {
  return {
    conversations: vi.fn(),
  };
});

vi.mock('/@/stores/inferenceServers', async () => {
  return {
    inferenceServers: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(inferenceServersStore).inferenceServers = readable([]);
});

test('should display playground and model names in header', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: ['model-1'],
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const header = screen.getByRole('region', { name: 'header' });
    expect(header).toBeInTheDocument();
    const title = within(header).getAllByText('Playground 1')[0];
    expect(title).toBeInTheDocument();
    const subtitle = within(header).getAllByText('Model 1')[0];
    expect(subtitle).toBeInTheDocument();
  });
});

test('send prompt should be enabled initially', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeEnabled();
  });
});

test('send prompt should be disabled initially if model server is not healhty', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
      health: {
        Status: 'starting',
      },
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeDisabled();
  });
});

test('send prompt should be disabled initially if model server is not running', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'stopped',
      health: {
        Status: '',
      },
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeDisabled();
  });
});

test('send prompt should be enabled initially, with a system prompt', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([
    {
      id: 'playground-1',
      messages: [
        {
          role: 'system',
          content: 'a prompt',
        } as SystemPrompt,
      ],
    },
  ]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeEnabled();
  });
});

test('sending prompt should disable the send button', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue();
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  let send: HTMLElement;
  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeInTheDocument();
  });
  fireEvent.click(send!);

  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeDisabled();
  });
});

test('receiving complete message should enable the send button', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue();
  render(Playground, {
    playgroundId: 'playground-1',
  });

  let send: HTMLElement;
  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeInTheDocument();
  });
  fireEvent.click(send!);

  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeDisabled();
  });

  customConversations.set([
    {
      id: 'playground-1',
      messages: [
        {
          role: 'user',
          id: 'message-1',
          content: 'a prompt',
        } as UserChat,
        {
          role: 'assistant',
          id: 'message-2',
          content: 'a response',
          completed: Date.now(),
        } as AssistantChat,
      ],
    },
  ]);

  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeEnabled();
  });
});

test('sending prompt should display the prompt and the response', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [
      {
        id: 'model-1',
        name: 'Model 1',
      },
    ] as ModelInfo[],
    recipes: [],
    categories: [],
  });
  vi.mocked(studioClient.getPlaygroundsV2).mockResolvedValue([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
    },
  ]);
  const customConversations = writable<Conversation[]>([]);
  vi.mocked(conversationsStore).conversations = customConversations;
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue();
  render(Playground, {
    playgroundId: 'playground-1',
  });

  let send: HTMLElement;
  await waitFor(() => {
    send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeInTheDocument();
  });
  const textarea = screen.getByLabelText('prompt');
  expect(textarea).toBeInTheDocument();
  await userEvent.type(textarea, 'a question for the assistant');

  fireEvent.click(send!);

  customConversations.set([
    {
      id: 'playground-1',
      messages: [
        {
          role: 'user',
          id: 'message-1',
          content: 'a question for the assistant',
        } as UserChat,
        {
          role: 'assistant',
          id: 'message-2',
          choices: [{ content: 'a ' }, { content: 'response ' }, { content: 'from ' }, { content: 'the ' }],
          completed: false,
        } as unknown as PendingChat,
      ],
    },
  ]);

  await waitFor(() => {
    const conversation = screen.getByLabelText('conversation');
    within(conversation).getByText('a question for the assistant');
    within(conversation).getByText('a response from the');
  });

  customConversations.set([
    {
      id: 'playground-1',
      messages: [
        {
          role: 'user',
          id: 'message-1',
          content: 'a question for the assistant',
        } as UserChat,
        {
          role: 'assistant',
          id: 'message-2',
          content: 'a response from the assistant',
          completed: Date.now(),
        } as AssistantChat,
      ],
    },
  ]);

  await waitFor(() => {
    const conversation = screen.getByLabelText('conversation');
    within(conversation).getByText('a question for the assistant');
    within(conversation).getByText('a response from the assistant');
  });
});
