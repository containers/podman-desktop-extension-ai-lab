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
import { render, within } from '@testing-library/svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import { studioClient } from '../utils/client';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import * as tasksStore from '/@/stores/tasks';
import * as modelsInfoStore from '/@/stores/modelsInfo';
import type { Task } from '@shared/src/models/ITask';
import PlaygroundCreate from './PlaygroundCreate.svelte';
import { InferenceType } from '@shared/src/models/IInference';

const dummyLlamaCppModel: ModelInfo = {
  id: 'llama-cpp-model-id',
  name: 'Dummy LlamaCpp model',
  file: {
    file: 'file',
    path: '/tmp/path',
  },
  properties: {},
  description: '',
  backend: InferenceType.LLAMA_CPP,
};

const dummyWhisperCppModel: ModelInfo = {
  id: 'whisper-cpp-model-id',
  name: 'Dummy Whisper model',
  file: {
    file: 'file',
    path: '/tmp/path',
  },
  properties: {},
  description: '',
  backend: InferenceType.WHISPER_CPP,
};

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      requestCreatePlayground: vi.fn(),
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

vi.mock('/@/stores/tasks', async () => {
  return {
    tasks: vi.fn(),
  };
});

vi.mock('/@/stores/modelsInfo', async () => {
  return {
    modelsInfo: vi.fn(),
  };
});

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  const tasksList = writable<Task[]>([]);
  vi.mocked(tasksStore).tasks = tasksList;
});

test('model should be selected by default', () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  vi.mocked(studioClient.requestCreatePlayground).mockRejectedValue('error creating playground');

  const { container } = render(PlaygroundCreate);

  const model = within(container).getByText(dummyLlamaCppModel.name);
  expect(model).toBeInTheDocument();
});

test('models with incompatible backend should not be listed', async () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyWhisperCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  const { container } = render(PlaygroundCreate);

  const model = within(container).queryByText(dummyWhisperCppModel.name);
  expect(model).toBeNull();
});

test('should display error message if createPlayground fails', async () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  vi.mocked(studioClient.requestCreatePlayground).mockRejectedValue('error creating playground');

  const { container } = render(PlaygroundCreate);

  const errorMessage = within(container).queryByLabelText('Error Message Content');
  expect(errorMessage).not.toBeInTheDocument();

  const createButton = within(container).getByTitle('Create playground');
  await userEvent.click(createButton);

  const errorMessageAfterSubmit = within(container).queryByLabelText('Error Message Content');
  expect(errorMessageAfterSubmit).toBeInTheDocument();
  expect(errorMessageAfterSubmit?.textContent).equal('error creating playground');
});
