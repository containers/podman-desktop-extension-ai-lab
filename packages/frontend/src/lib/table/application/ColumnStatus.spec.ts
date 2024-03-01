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
import type { ApplicationCell } from '../../../pages/applications';
import ColumnStatus from './ColumnStatus.svelte';

test('display Pod Running when no task', async () => {
  const obj = {
    recipeId: 'recipe 1',
    envState: {
      pod: {
        Id: 'pod-1',
      },
    },
  } as ApplicationCell;
  render(ColumnStatus, { object: obj });

  const text = screen.getByText('Pod running');
  expect(text).toBeInTheDocument();
});

test('display latest task', async () => {
  const obj = {
    recipeId: 'recipe 1',
    envState: {
      pod: {
        Id: 'pod-1',
      },
    },
    tasks: [
      {
        id: 'task1',
        name: 'task 1 done',
        state: 'success',
      },
      {
        id: 'task2',
        name: 'task 2 running',
        state: 'loading',
      },
    ],
  } as ApplicationCell;
  render(ColumnStatus, { object: obj });

  const text = screen.getByText('task 2 running');
  expect(text).toBeInTheDocument();
});
