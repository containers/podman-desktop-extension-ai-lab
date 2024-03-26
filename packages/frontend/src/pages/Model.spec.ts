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
import { screen, render } from '@testing-library/svelte';
import Model from './Model.svelte';
import catalog from '../../../backend/src/tests/ai-user-test.json';

const mocks = vi.hoisted(() => {
  return {
    getCatalogMock: vi.fn(),
  };
});

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getCatalog: mocks.getCatalogMock,
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

test('should display model information', async () => {
  const model = catalog.models.find(m => m.id === 'model1');
  expect(model).not.toBeUndefined();

  mocks.getCatalogMock.mockResolvedValue(catalog);
  render(Model, {
    modelId: 'model1',
  });
  await new Promise(resolve => setTimeout(resolve, 200));

  expect(screen.getAllByText(model!.name).length).toBeGreaterThan(0);
  screen.getByText(model!.description);
});
