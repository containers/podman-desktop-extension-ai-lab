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
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';
import InstructlabColumnModelName from './InstructlabColumnModelName.svelte';
import type { InstructlabSession } from '@shared/models/instructlab/IInstructlabSession';
import * as catalogStore from '/@/stores/catalog';
import { readable } from 'svelte/store';
import type { ApplicationCatalog } from '@shared/models/IApplicationCatalog';
import { router } from 'tinro';

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
      description: '',
      registry: '',
      license: '',
      url: '',
      memory: 1000,
    },
    {
      id: 'model2',
      name: 'Model 2',
      description: '',
      registry: '',
      license: '',
      url: '',
      memory: 1000,
    },
  ],
  recipes: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('display model name', async () => {
  const obj = {
    modelId: 'model1',
  } as unknown as InstructlabSession;

  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(InstructlabColumnModelName, { object: obj });

  const text = screen.getByText('Model 1');
  expect(text).toBeInTheDocument();
});

test('click on name should open details page', async () => {
  const gotoMock = vi.spyOn(router, 'goto');
  const obj = {
    modelId: 'model1',
  } as unknown as InstructlabSession;
  vi.mocked(catalogStore).catalog = readable<ApplicationCatalog>(initialCatalog);
  render(InstructlabColumnModelName, { object: obj });

  const nameBtn = screen.getByTitle('Open model details');
  expect(nameBtn).toBeDefined();
  await fireEvent.click(nameBtn);

  expect(gotoMock).toHaveBeenCalledWith('/model/model1');
});
