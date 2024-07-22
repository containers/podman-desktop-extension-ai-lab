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
import { beforeEach, test, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/svelte';
import ModelSelect from '/@/lib/ModelSelect.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { InferenceType } from '@shared/src/models/IInference';

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

beforeEach(() => {
  // mock scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = function () {};
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

test('ModelSelect should set star icon next to recommended model', async () => {
  const { container } = render(ModelSelect, {
    value: undefined,
    disabled: undefined,
    models: [fakeRecommendedModel, fakeRemoteModel],
    recommended: [fakeRemoteModel.id],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Model');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(within(items[0]).queryByTitle('Recommended model')).toBeNull();
  expect(within(items[1]).getByTitle('Recommended model')).toBeDefined();
});
