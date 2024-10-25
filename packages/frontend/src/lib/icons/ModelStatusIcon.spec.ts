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
import { expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import ModelColumnIcon from './ModelStatusIcon.svelte';
import { type InferenceServer, InferenceType } from '@shared/src/models/IInference';
import { readable } from 'svelte/store';
import * as inferenceStore from '/@/stores/inferenceServers';

vi.mock('/@/stores/inferenceServers', () => ({
  inferenceServers: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  (inferenceStore.inferenceServers as unknown) = readable<InferenceServer[]>([]);
});

test('Expect remote model to have NONE title', async () => {
  const object: ModelInfo = {
    id: 'model-downloaded-id',
    description: '',
    license: '',
    name: '',
    registry: '',
    url: '',
    memory: 1000,
  };

  render(ModelColumnIcon, { object });

  const role = screen.getByRole('status');
  expect(role).toBeDefined();
  expect(role.title).toBe('NONE');
});

test('Expect downloaded model to have DOWNLOADED title', async () => {
  const object: ModelInfo = {
    id: 'model-downloaded-id',
    description: '',
    license: '',
    name: '',
    registry: '',
    url: '',
    file: {
      file: 'file',
      creation: undefined,
      size: 1000,
      path: 'path',
    },
    memory: 1000,
  };

  render(ModelColumnIcon, { object });

  const role = screen.getByRole('status');
  expect(role).toBeDefined();
  expect(role.title).toBe('DOWNLOADED');
});

test('Expect in used model to have USED title', async () => {
  const object: ModelInfo = {
    id: 'model-in-used-id',
    description: '',
    license: '',
    name: '',
    registry: '',
    url: '',
    file: {
      file: 'file',
      creation: undefined,
      size: 1000,
      path: 'path',
    },
    memory: 1000,
  };

  (inferenceStore.inferenceServers as unknown) = readable<InferenceServer[]>([
    {
      models: [object],
      type: InferenceType.LLAMA_CPP,
      status: 'running',
      container: {
        containerId: '',
        engineId: '',
      },
      connection: {
        port: 0,
      },
      health: undefined,
      labels: {},
    },
  ]);

  render(ModelColumnIcon, { object });

  const role = screen.getByRole('status');
  expect(role).toBeDefined();
  expect(role.title).toBe('USED');
});

test('Expect non-downloaded model to have NONE title', async () => {
  const object: ModelInfo = {
    id: 'model-downloaded-id',
    description: '',
    license: '',
    name: '',
    registry: '',
    url: '',
    memory: 1000,
  };

  render(ModelColumnIcon, { object });

  const role = screen.getByRole('status');
  expect(role).toBeDefined();
  expect(role.title).toBe('NONE');
});
