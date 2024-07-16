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
import { beforeEach, test, expect, vi } from 'vitest';
import { render, within } from '@testing-library/svelte';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import ApplicationTable from '/@/lib/table/application/ApplicationTable.svelte';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';

const mocks = vi.hoisted(() => ({
  getApplicationStates: vi.fn<() => ApplicationState[]>(),
}));

vi.mock('../../../stores/application-states', () => ({
  applicationStates: {
    subscribe: (fn: (items: ApplicationState[]) => void) => {
      fn(mocks.getApplicationStates());
      return vi.fn();
    },
  },
}));

vi.mock('../../../stores/catalog', () => ({
  catalog: {
    subscribe: (fn: (item: ApplicationCatalog) => void) => {
      fn({ categories: [], models: [], recipes: [] });
      return vi.fn();
    },
  },
}));

vi.mock('../../../utils/client', async () => ({
  studioClient: {},
}));

beforeEach(() => {
  mocks.getApplicationStates.mockReturnValue([]);
});

test('expect pod to be displayed', async () => {
  mocks.getApplicationStates.mockReturnValue([
    {
      appPorts: [],
      health: 'healthy',
      modelId: 'model-id-1',
      modelPorts: [],
      pod: {
        engineId: 'dummy-engine-id',
        Id: 'pod-id-1',
        Status: 'Running',
        Name: 'Test Pod 1',
      },
      recipeId: 'recipe-id-1',
    } as unknown as ApplicationState,
  ]);

  const { container } = render(ApplicationTable);

  const div = within(container).getByText('Test Pod 1');
  expect(div).toBeDefined();
});

test('expect all pods to be displayed', async () => {
  mocks.getApplicationStates.mockReturnValue([
    {
      appPorts: [],
      health: 'healthy',
      modelId: 'model-id-1',
      modelPorts: [],
      pod: {
        engineId: 'dummy-engine-id',
        Id: 'pod-id-1',
        Status: 'Running',
        Name: 'Test Pod 1',
      },
      recipeId: 'recipe-id-1',
    } as unknown as ApplicationState,
    {
      appPorts: [],
      health: 'healthy',
      modelId: 'model-id-2',
      modelPorts: [],
      pod: {
        engineId: 'dummy-engine-id',
        Id: 'pod-id-2',
        Status: 'Running',
        Name: 'Test Pod 2',
      },
      recipeId: 'recipe-id-1',
    } as unknown as ApplicationState,
  ]);

  const { container } = render(ApplicationTable);

  const pod1 = within(container).getByText('Test Pod 1');
  expect(pod1).toBeDefined();

  const pod2 = within(container).getByText('Test Pod 2');
  expect(pod2).toBeDefined();
});

test('expect filter to work as expected', async () => {
  mocks.getApplicationStates.mockReturnValue([
    {
      appPorts: [],
      health: 'healthy',
      modelId: 'model-id-1',
      modelPorts: [],
      pod: {
        engineId: 'dummy-engine-id',
        Id: 'pod-id-1',
        Status: 'Running',
        Name: 'Test Pod 1',
      },
      recipeId: 'recipe-id-1',
    } as unknown as ApplicationState,
    {
      appPorts: [],
      health: 'healthy',
      modelId: 'model-id-2',
      modelPorts: [],
      pod: {
        engineId: 'dummy-engine-id',
        Id: 'pod-id-2',
        Status: 'Running',
        Name: 'Test Pod 2',
      },
      recipeId: 'recipe-id-2',
    } as unknown as ApplicationState,
  ]);

  const { container } = render(ApplicationTable, {
    filter: items => items.filter(item => item.recipeId !== 'recipe-id-2'),
  });

  const pod1 = within(container).getByText('Test Pod 1');
  expect(pod1).toBeDefined();

  const pod2 = within(container).queryByText('Test Pod 2');
  expect(pod2).toBeNull();
});
