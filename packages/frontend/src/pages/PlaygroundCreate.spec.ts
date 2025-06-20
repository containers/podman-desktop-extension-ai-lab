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
import type { ModelInfo } from '@shared/models/IModelInfo';
import { writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import * as tasksStore from '/@/stores/tasks';
import * as modelsInfoStore from '/@/stores/modelsInfo';
import type { Task } from '@shared/models/ITask';
import PlaygroundCreate from './PlaygroundCreate.svelte';
import { InferenceType } from '@shared/models/IInference';
import * as path from 'node:path';
import * as os from 'node:os';

const dummyLlamaCppModel: ModelInfo = {
  id: 'llama-cpp-model-id',
  name: 'Dummy LlamaCpp model',
  file: {
    file: 'file',
    path: path.resolve(os.tmpdir(), 'path'),
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
    path: path.resolve(os.tmpdir(), 'path'),
  },
  properties: {},
  description: '',
  backend: InferenceType.WHISPER_CPP,
};

const dummyOpenVinoModel: ModelInfo = {
  id: 'openvino-model-id',
  name: 'Dummy Openvino model',
  file: {
    file: 'file',
    path: path.resolve(os.tmpdir(), 'path'),
  },
  properties: {},
  description: '',
  backend: InferenceType.OPENVINO,
};

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      requestCreatePlayground: vi.fn(),
      getExtensionConfiguration: vi.fn().mockResolvedValue({}),
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

test('model should not be selected by default when no runtime is set', () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  const { container } = render(PlaygroundCreate);

  // Model should not be displayed because it's filtered out when runtime is undefined
  const model = within(container).queryByText(dummyLlamaCppModel.name);
  expect(model).toBeNull();
});

test('model should be selected by default when runtime is set', async () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  vi.mocked(studioClient.requestCreatePlayground).mockRejectedValue('error creating playground');

  const { container } = render(PlaygroundCreate);

  // Select our runtime
  const dropdown = within(container).getByLabelText('Select Inference Runtime');
  await userEvent.click(dropdown);

  const llamacppOption = within(container).getByText(InferenceType.LLAMA_CPP);
  await userEvent.click(llamacppOption);

  const model = within(container).getByText(dummyLlamaCppModel.name);
  expect(model).toBeInTheDocument();
});

test('selecting a runtime filters the displayed models', async () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel, dummyWhisperCppModel, dummyOpenVinoModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;
  const { container } = render(PlaygroundCreate);

  // Select our runtime
  const dropdown = within(container).getByLabelText('Select Inference Runtime');
  await userEvent.click(dropdown);

  const openvinoOption = within(container).getByText(InferenceType.OPENVINO);
  await userEvent.click(openvinoOption);

  expect(within(container).queryByText(dummyOpenVinoModel.name)).toBeInTheDocument();
  expect(within(container).queryByText(dummyLlamaCppModel.name)).toBeNull();
  expect(within(container).queryByText(dummyWhisperCppModel.name)).toBeNull();
});

test('should show warning when no local models are available', () => {
  const modelsInfoList = writable<ModelInfo[]>([]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  const { container } = render(PlaygroundCreate);

  const warning = within(container).getByText(/You don't have any models downloaded/);
  expect(warning).toBeInTheDocument();
});

test('should display error message if createPlayground fails', async () => {
  const modelsInfoList = writable<ModelInfo[]>([dummyLlamaCppModel]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  vi.mocked(studioClient.requestCreatePlayground).mockRejectedValue('error creating playground');

  const { container } = render(PlaygroundCreate);

  const errorMessage = within(container).queryByLabelText('Error Message Content');
  expect(errorMessage).not.toBeInTheDocument();

  //make sure to select model
  const dropdown = within(container).getByLabelText('Select Model');
  await userEvent.click(dropdown);
  const option = within(container).getByText(dummyLlamaCppModel.name);
  await userEvent.click(option);

  const createButton = within(container).getByTitle('Create playground');
  await userEvent.click(createButton);

  const errorMessageAfterSubmit = within(container).queryByLabelText('Error Message Content');
  expect(errorMessageAfterSubmit).toBeInTheDocument();
  expect(errorMessageAfterSubmit?.textContent).equal('error creating playground');
});
