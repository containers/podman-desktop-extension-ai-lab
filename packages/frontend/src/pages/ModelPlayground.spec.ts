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
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, fireEvent, render, waitFor } from '@testing-library/svelte';
import ModelPlayground from './ModelPlayground.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const mocks = vi.hoisted(() => {
  return {
    navigateToContainerMock: vi.fn(),
    startPlaygroundMock: vi.fn(),
    askPlaygroundMock: vi.fn(),
    getPlaygroundsStateMock: vi.fn().mockImplementation(() => Promise.resolve([])),
    playgroundQueriesSubscribeMock: vi.fn(),
    playgroundQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.playgroundQueriesSubscribeMock());
        return () => {};
      },
    },
    playgroundStatesSubscribeMock: vi.fn().mockReturnValue([]),
    playgroundStatesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.playgroundStatesSubscribeMock());
        return () => {};
      },
    },
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      navigateToContainer: mocks.navigateToContainerMock,
      getPlaygroundsState: mocks.getPlaygroundsStateMock,
      startPlayground: mocks.startPlaygroundMock,
      askPlayground: mocks.askPlaygroundMock,
      askPlaygroundQueries: () => {},
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

vi.mock('../stores/playground-queries', async () => {
  return {
    playgroundQueries: mocks.playgroundQueriesMock,
  };
});

vi.mock('../stores/playground-states', async () => {
  return {
    playgroundStates: mocks.playgroundStatesMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('playground should start when clicking on the play button', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([]);
  mocks.startPlaygroundMock.mockResolvedValue(undefined);
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });

  const play = screen.getByTitle('playground-action');
  expect(play).toBeDefined();

  await fireEvent.click(play);

  await waitFor(() => {
    expect(mocks.startPlaygroundMock).toHaveBeenCalledOnce();
  });
});

test('playground should display error when clicking on the play button and an error occurs', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([]);
  mocks.startPlaygroundMock.mockRejectedValue('bad error');
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });

  const play = screen.getByTitle('playground-action');
  expect(play).toBeDefined();

  await fireEvent.click(play);

  await waitFor(() => {
    expect(mocks.startPlaygroundMock).toHaveBeenCalledOnce();
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe('Something went wrong while trying to start playground: bad error');
  });
});

test('should display query without response', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([
    {
      id: 1,
      modelId: 'model1',
      prompt: 'what is 1+1?',
    },
  ]);
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });
  await waitFor(() => {
    const prompt = screen.getByPlaceholderText('Type your prompt here');
    expect(prompt).toBeInTheDocument();
    expect(prompt).toHaveValue('what is 1+1?');
  });

  const response = screen.queryByRole('textbox', { name: 'response' });
  expect(response).not.toBeInTheDocument();
});

test('should display query without response', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([
    {
      id: 1,
      modelId: 'model1',
      prompt: 'what is 1+1?',
      response: {
        choices: [
          {
            text: 'The response is 2',
          },
        ],
      },
    },
  ]);
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });

  await waitFor(() => {
    const prompt = screen.getByPlaceholderText('Type your prompt here');
    expect(prompt).toBeInTheDocument();
    expect(prompt).toHaveValue('what is 1+1?');
  });

  const response = screen.queryByRole('textbox', { name: 'response' });
  expect(response).toBeInTheDocument();
  expect(response).toHaveValue('The response is 2');
});

test('should display error alert', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([
    {
      id: 1,
      modelId: 'model1',
      prompt: 'what is 1+1?',
      error: 'dummy error',
    },
  ]);
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });

  await waitFor(() => {
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });
});

test('playground container icon should redirect', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([]);
  mocks.playgroundStatesSubscribeMock.mockReturnValue([
    {
      modelId: 'model1',
      container: {
        containerId: 'dummy-container-id',
      },
    },
  ]);
  render(ModelPlayground, {
    model: {
      id: 'model1',
      name: 'Model 1',
      description: 'A description',
      hw: 'CPU',
      registry: 'Hugging Face',
      popularity: 3,
      license: '?',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q5_K_S.gguf',
    } as ModelInfo,
  });

  await waitFor(async () => {
    const navigateTo = screen.getByTitle('navigate-to-container');
    expect(navigateTo).toBeDefined();

    await fireEvent.click(navigateTo);
  });

  expect(mocks.navigateToContainerMock).toHaveBeenNthCalledWith(1, 'dummy-container-id');
});
