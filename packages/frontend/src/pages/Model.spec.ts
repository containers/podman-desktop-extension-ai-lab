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

import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Model from './Model.svelte';
import { studioClient } from '../utils/client';
import type { ModelInfo } from '@shared/models/IModelInfo';
import * as inferenceStore from '/@/stores/inferenceServers';
import { readable } from 'svelte/store';
import type { InferenceServer } from '@shared/models/IInference';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: vi.fn(),
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

vi.mock('/@/stores/inferenceServers', () => ({
  inferenceServers: vi.fn(),
}));

const model: ModelInfo = {
  id: 'model1',
  name: 'Model 1',
  properties: {},
  description: '',
};

beforeEach(() => {
  (inferenceStore.inferenceServers as unknown) = readable<InferenceServer[]>([]);
});

test('model status should be visible', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [model],
    categories: [],
    recipes: [],
    version: 'v1',
  });

  const { getByRole } = render(Model, {
    modelId: model.id,
  });

  await vi.waitFor(() => {
    const role = getByRole('status');
    expect(role).toBeDefined();
    expect(role.title).toBe('NONE');
  });
});

test('should display model information', async () => {
  vi.mocked(studioClient.getCatalog).mockResolvedValue({
    models: [model],
    categories: [],
    recipes: [],
    version: 'v1',
  });

  render(Model, {
    modelId: 'model1',
  });

  await vi.waitFor(() => {
    const elements = screen.getAllByText(model.name);
    expect(elements.length).toBeGreaterThan(0);
  });
});
