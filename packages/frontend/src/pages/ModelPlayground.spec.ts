import '@testing-library/jest-dom/vitest';
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/svelte';
import ModelPlayground from './ModelPlayground.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => {
  return {
    startPlaygroundMock: vi.fn(),
    askPlaygroundMock: vi.fn(),
    playgroundQueriesSubscribeMock: vi.fn(),
    playgroundQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.playgroundQueriesSubscribeMock());
        return () => {};
      },
    },
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
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

beforeEach(() => {
  vi.clearAllMocks();
});

test('should start playground at init time and call askPlayground when button clicked', async () => {
  mocks.playgroundQueriesSubscribeMock.mockReturnValue([]);
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
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(mocks.startPlaygroundMock).toHaveBeenCalledOnce();

  const prompt = screen.getByPlaceholderText('Type your prompt here');
  expect(prompt).toBeInTheDocument();
  const user = userEvent.setup();
  user.type(prompt, 'what is it?');

  const send = screen.getByRole('button', { name: 'Send Request' });
  expect(send).toBeInTheDocument();

  expect(mocks.askPlaygroundMock).not.toHaveBeenCalled();
  await fireEvent.click(send);
  expect(mocks.askPlaygroundMock).toHaveBeenCalledOnce();
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
  await new Promise(resolve => setTimeout(resolve, 200));

  const prompt = screen.getByPlaceholderText('Type your prompt here');
  expect(prompt).toBeInTheDocument();
  expect(prompt).toHaveValue('what is 1+1?');

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
  await new Promise(resolve => setTimeout(resolve, 200));

  const prompt = screen.getByPlaceholderText('Type your prompt here');
  expect(prompt).toBeInTheDocument();
  expect(prompt).toHaveValue('what is 1+1?');

  const response = screen.queryByRole('textbox', { name: 'response' });
  expect(response).toBeInTheDocument();
  expect(response).toHaveValue('The response is 2');
});

test('', async () => {});
