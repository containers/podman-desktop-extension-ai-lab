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
import { beforeEach, expect, test, vi, describe } from 'vitest';
import Playground from './Playground.svelte';
import { studioClient } from '../utils/client';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { fireEvent } from '@testing-library/dom';
import type { AssistantChat, ModelUsage, PendingChat, UserChat } from '@shared/models/IPlaygroundMessage';
import * as conversationsStore from '/@/stores/conversations';
import * as inferenceServersStore from '/@/stores/inferenceServers';
import { readable, writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import { InferenceType, type InferenceServer } from '@shared/models/IInference';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: vi.fn(),
      submitPlaygroundMessage: vi.fn(),
      requestCancelToken: vi.fn(),
      getMcpSettings: vi.fn(async () => ({ servers: {} })),
    },
    rpcBrowser: {
      subscribe: (): unknown => {
        return {
          unsubscribe: (): void => {},
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

const customConversations = writable<conversationsStore.ConversationWithBackend[]>([
  {
    id: 'playground-1',
    name: 'Playground 1',
    modelId: 'model-1',
    messages: [],
    usage: {} as ModelUsage,
    backend: InferenceType.LLAMA_CPP,
  },
]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(inferenceServersStore).inferenceServers = readable([]);

  // mock catalog
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
  vi.mocked(studioClient.requestCancelToken).mockResolvedValue(undefined);

  // mock conversation
  vi.mocked(conversationsStore).conversations = customConversations;

  // mock inference server
  vi.mocked(inferenceServersStore).inferenceServers = readable([
    {
      models: [{ id: 'model-1' }],
      status: 'running',
    } as unknown as InferenceServer,
  ]);
});

test('should display playground and model names in header', async () => {
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    // TODO: restrict to header when https://github.com/containers/podman-desktop/issues/7740 is fixed
    const title = screen.getAllByText('Playground 1')[0];
    expect(title).toBeInTheDocument();
    const subtitle = screen.getByLabelText('Model name');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle.textContent).equals('Model 1');
  });
});

test('send prompt should not be enabled initially', async () => {
  render(Playground, {
    playgroundId: 'playground-1',
  });

  await waitFor(() => {
    const send = screen.getByRole('button', { name: 'Send prompt' });
    expect(send).toBeDisabled();
  });
});

test('send prompt should be disabled initially if model server is not healhty', async () => {
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

test('sending prompt should disable the send button and the input element', async () => {
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue(0);
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
    const input = screen.getByRole('textbox', { name: 'prompt' });
    expect(input).toBeDisabled();
  });
});

test('sending prompt not using button should disable the send button and the input element', async () => {
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue(0);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  let prompt: HTMLElement;
  await waitFor(() => {
    prompt = screen.getByLabelText('prompt');
    expect(prompt).toBeInTheDocument();
  });
  fireEvent.change(prompt!, { target: { value: 'prompt' } });
  fireEvent.keyDown(prompt!, { key: 'Enter' });

  await waitFor(() => {
    prompt = screen.getByRole('button', { name: 'Send prompt' });
    expect(prompt).toBeDisabled();
    const input = screen.getByRole('textbox', { name: 'prompt' });
    expect(input).toBeDisabled();
  });
});

test('receiving complete message should enable the input element', async () => {
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue(0);
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
    const input = screen.getByRole('textbox', { name: 'prompt' });
    expect(input).toBeDisabled();
  });

  customConversations.set([
    {
      id: 'playground-1',
      name: 'Playground 1',
      modelId: 'model-1',
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
      usage: {} as ModelUsage,
      backend: InferenceType.LLAMA_CPP,
    },
  ]);

  await waitFor(() => {
    const input = screen.getByRole('textbox', { name: 'prompt' });
    expect(input).toBeEnabled();
  });
});

test('sending prompt should display the prompt and the response', async () => {
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue(0);
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
      name: 'Playground 1',
      modelId: 'model-1',
      messages: [
        {
          role: 'user',
          id: 'message-1',
          content: 'a question for the assistant',
        } as UserChat,
        {
          role: 'assistant',
          id: 'message-2',
          content: 'a response from the ',
          completed: false,
        } as unknown as PendingChat,
      ],
      usage: {} as ModelUsage,
      backend: InferenceType.LLAMA_CPP,
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
      name: 'Playground 1',
      modelId: 'model-1',
      messages: [
        {
          role: 'user',
          id: 'message-1',
          content: 'a question for the assistant',
        } as UserChat,
        {
          role: 'assistant',
          id: 'message-2',
          content: 'a response from the assistant\neat, sleep, code, repeat\neat, sleep, code, repeat',
          completed: Date.now(),
        } as AssistantChat,
      ],
      usage: {} as ModelUsage,
      backend: InferenceType.LLAMA_CPP,
    },
  ]);

  await waitFor(() => {
    const conversation = screen.getByLabelText('conversation');
    within(conversation).getByText('a question for the assistant');
    within(conversation).getByText('a response from the assistant');
  });
});

test('user should be able to stop prompt', async () => {
  vi.mocked(studioClient.submitPlaygroundMessage).mockResolvedValue(55);
  render(Playground, {
    playgroundId: 'playground-1',
  });

  let prompt: HTMLElement;
  await waitFor(() => {
    prompt = screen.getByLabelText('prompt');
    expect(prompt).toBeInTheDocument();
  });
  fireEvent.change(prompt!, { target: { value: 'prompt' } });
  fireEvent.keyDown(prompt!, { key: 'Enter' });

  await waitFor(() => {
    const stopBtn = screen.getByTitle('Stop');
    expect(stopBtn).toBeDefined();

    fireEvent.click(stopBtn);
  });

  await vi.waitFor(() => {
    expect(studioClient.requestCancelToken).toHaveBeenCalledWith(55);
  });
});

describe('error message', () => {
  test('submitPlaygroundMessage reject should be displayed', async () => {
    // mock reject
    vi.mocked(studioClient.submitPlaygroundMessage).mockRejectedValue(new Error('dummy'));

    const { getByRole } = render(Playground, {
      playgroundId: 'playground-1',
    });

    // Get the input
    const prompt: HTMLElement = await waitFor<HTMLElement>(() => {
      const element = getByRole('textbox', { name: 'prompt' });
      expect(element).toBeInTheDocument();
      return element;
    });

    fireEvent.change(prompt, { target: { value: 'prompt' } });
    fireEvent.keyDown(prompt, { key: 'Enter' });

    // Get the error div
    const error: HTMLElement = await waitFor<HTMLElement>(() => {
      const element = getByRole('alert', { name: 'error' });
      expect(element).toBeInTheDocument();
      return element;
    });

    expect(error).toHaveTextContent('Error: dummy');
  });

  test('error message should display the content', async () => {
    // mock conversation
    vi.mocked(conversationsStore).conversations = writable([
      {
        id: 'playground-1',
        name: 'Playground 1',
        modelId: 'model-1',
        messages: [
          {
            id: 'error-message-id',
            error: 'something went wrong with the server',
            timestamp: 55,
          },
        ],
        backend: InferenceType.LLAMA_CPP,
      },
    ]);

    const { getByRole } = render(Playground, {
      playgroundId: 'playground-1',
    });

    // Get the error div
    const error: HTMLElement = await waitFor<HTMLElement>(() => {
      const element = getByRole('alert', { name: 'error' });
      expect(element).toBeInTheDocument();
      return element;
    });

    expect(error).toHaveTextContent('something went wrong with the server');
  });
});
