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
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import ModelColumnSize from './ModelColumnSize.svelte';

test('Expect simple column styling', async () => {
  const object: ModelInfo = {
    id: 'my-model',
    description: '',
    hw: '',
    license: '',
    name: '',
    registry: '',
    url: '',
    file: {
      file: 'file',
      creation: new Date(),
      size: 1000,
      path: 'path',
    },
    memory: 1000,
  };
  render(ModelColumnSize, { object });

  const text = screen.getByText('1 kB');
  expect(text).toBeInTheDocument();
  expect(text).toHaveClass('text-sm');
  expect(text).toHaveClass('text-gray-700');
});
