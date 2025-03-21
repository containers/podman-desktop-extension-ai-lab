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
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ModelInfo } from '@shared/models/IModelInfo';
import ModelColumnName from './ModelColumnName.svelte';
import userEvent from '@testing-library/user-event';
import { router } from 'tinro';

test('Expect model info lower bar to be visible', async () => {
  const routerMock = vi.spyOn(router, 'goto');
  const object: ModelInfo = {
    id: 'my-model',
    description: '',
    license: 'apache-2',
    name: 'My model',
    registry: 'registry',
    url: 'url',
    file: {
      file: 'file',
      size: 1000,
      path: 'path',
    },
    memory: 1000,
  };
  render(ModelColumnName, { object });
  const name = screen.getByLabelText('Model Name');
  expect(name.textContent).equal('My model');

  const info = screen.getByLabelText('Model Info');
  expect(info.textContent).equal('registry - apache-2');

  const importedInfo = screen.queryByLabelText('Imported Model Info');
  expect(importedInfo).not.toBeInTheDocument();

  const modelNameBtn = screen.getByRole('button', { name: 'Open Model Details' });
  await userEvent.click(modelNameBtn);
  expect(routerMock).toBeCalledWith('/model/my-model');
});

test('Expect model info lower bar to be visible', async () => {
  const routerMock = vi.spyOn(router, 'goto');
  const object: ModelInfo = {
    id: 'my-model',
    description: '',
    license: '',
    name: 'My model',
    registry: '',
    url: '',
    file: {
      file: 'file',
      size: 1000,
      path: 'path',
    },
    memory: 1000,
  };
  render(ModelColumnName, { object });
  const name = screen.getByLabelText('Model Name');
  expect(name.textContent).equal('My model');

  const info = screen.queryByLabelText('Model Info');
  expect(info).not.toBeInTheDocument();

  const importedInfo = screen.getByLabelText('Imported Model Info');
  expect(importedInfo.textContent).equal('Imported by User');

  const modelNameBtn = screen.getByRole('button', { name: 'Open Model Details' });
  await userEvent.click(modelNameBtn);
  expect(routerMock).toBeCalledWith('/model/my-model');
});
