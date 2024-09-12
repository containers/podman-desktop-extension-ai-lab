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

import { vi, test, expect } from 'vitest';
import { screen, render, within } from '@testing-library/svelte';
import Playgrounds from '/@/pages/Playgrounds.svelte';
import * as catalogStore from '/@/stores/catalog';
import { readable } from 'svelte/store';
import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';

const mocks = vi.hoisted(() => {
  return {
    conversationSubscribeMock: vi.fn(),
    conversationsQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.conversationSubscribeMock());
        return (): void => {};
      },
    },
  };
});

vi.mock('/@/utils/client', async () => {
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

vi.mock('../stores/conversations', async () => {
  return {
    conversations: mocks.conversationsQueriesMock,
  };
});

vi.mock('/@/stores/catalog', async () => {
  return {
    catalog: vi.fn(),
  };
});

const initialCatalog: ApplicationCatalog = {
  categories: [],
  models: [
    {
      id: 'model1',
      name: 'Model 1',
      description: 'Readme for model 1',
      registry: 'Hugging Face',
      license: '?',
      url: 'https://model1.example.com',
      memory: 1000,
    },
  ],
  recipes: [],
};

test('should display There is no playground yet', async () => {
  mocks.conversationSubscribeMock.mockResolvedValue([]);
  render(Playgrounds);

  const title = screen.getByText('No Playground Environment');
  expect(title).toBeDefined();
});

test('should display one model', async () => {
  mocks.conversationSubscribeMock.mockReturnValue([
    {
      id: 'playground-0',
      name: 'Playground 0',
      modelId: 'model1',
      messages: [],
    },
  ]);
  vi.mocked(catalogStore).catalog = readable(initialCatalog);

  render(Playgrounds);

  const table = screen.getByRole('table');
  expect(table).toBeDefined();
  screen.debug(table, 4096);

  const rows = screen.queryAllByRole('row');
  expect(rows.length > 0).toBeTruthy();

  const icon = await within(rows[1]).findByRole('img');
  expect(icon).toBeDefined();
});
