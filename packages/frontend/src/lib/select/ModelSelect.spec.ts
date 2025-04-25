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
import { beforeEach, vi, test, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/svelte';
import ModelSelect from '/@/lib/select/ModelSelect.svelte';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { InferenceType } from '@shared/models/IInference';
import { writable, type Writable } from 'svelte/store';
import type { ExtensionConfiguration } from '@shared/models/IExtensionConfiguration';
import { configuration } from '/@/stores/extensionConfiguration';

vi.mock('../../stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

const mockConfiguration: Writable<ExtensionConfiguration> = writable({
  inferenceRuntime: 'llama-cpp',
  experimentalGPU: false,
  showGPUPromotion: false,
  modelUploadDisabled: false,
  modelsPath: '',
  experimentalTuning: false,
  apiPort: -1,
  appearance: 'dark',
});

const fakeRecommendedModel: ModelInfo = {
  id: 'dummy-model-1',
  backend: InferenceType.LLAMA_CPP,
  name: 'Dummy Model 1',
  file: {
    file: 'dummy-model-file',
    path: 'dummy-model-path',
  },
} as unknown as ModelInfo;

const fakeRemoteModel: ModelInfo = {
  id: 'dummy-model-2',
  backend: InferenceType.LLAMA_CPP,
  name: 'Dummy Model 2',
} as unknown as ModelInfo;

const fakeRecommendedRemoteModel: ModelInfo = {
  id: 'dummy-model-3',
  backend: InferenceType.LLAMA_CPP,
  name: 'Dummy Model 3',
} as unknown as ModelInfo;

const fakeRemoteModelWhisper: ModelInfo = {
  id: 'dummy-model-4',
  backend: InferenceType.WHISPER_CPP,
  name: 'Dummy Model 4',
} as unknown as ModelInfo;

const fakeRemoteModelNone: ModelInfo = {
  id: 'dummy-model-5',
  backend: InferenceType.NONE,
  name: 'Dummy Model 5',
} as unknown as ModelInfo;

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      updateExtensionConfiguration: vi.fn(),
      telemetryLogUsage: vi.fn(),
    },
  };
});

vi.mock('../../stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  // mock scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(configuration).subscribe.mockImplementation(run => mockConfiguration.subscribe(run));
});

test('ModelSelect should list all models provided', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [fakeRecommendedModel, fakeRemoteModel],
    recommended: [],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(items[0]).toHaveTextContent(fakeRecommendedModel.name);
  expect(items[1]).toHaveTextContent(fakeRemoteModel.name);
});

test('ModelSelect should list all models based on selected runtime', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [fakeRecommendedModel, fakeRemoteModelWhisper, fakeRemoteModel, fakeRemoteModelNone],
    recommended: [],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(items[0]).toHaveTextContent(fakeRecommendedModel.name);
  expect(items[1]).toHaveTextContent(fakeRemoteModel.name);
});

test('ModelSelect should set star icon next to recommended model', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [fakeRecommendedModel, fakeRemoteModel],
    recommended: [fakeRecommendedModel.id],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(within(items[0]).getByTitle('Recommended model')).toBeDefined();
  expect(within(items[1]).queryByTitle('Recommended model')).toBeNull();
});

test('models should be sorted', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [fakeRemoteModel, fakeRecommendedRemoteModel, fakeRecommendedModel],
    recommended: [fakeRecommendedModel.id, fakeRecommendedRemoteModel.id],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(3);
  expect(items[0]).toHaveTextContent(fakeRecommendedModel.name);
  expect(items[1]).toHaveTextContent(fakeRecommendedRemoteModel.name);
  expect(items[2]).toHaveTextContent(fakeRemoteModel.name);
});

test('ModelSelect should filter out models based on selected default runtime', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [
      fakeRecommendedModel,
      fakeRemoteModel,
      fakeRemoteModelNone,
      fakeRemoteModelWhisper,
      fakeRecommendedRemoteModel,
    ],
    recommended: [],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(3);
  expect(items[0]).toHaveTextContent(fakeRecommendedModel.name);
  expect(items[1]).toHaveTextContent(fakeRemoteModel.name);
  expect(items[2]).toHaveTextContent(fakeRecommendedRemoteModel.name);
});
