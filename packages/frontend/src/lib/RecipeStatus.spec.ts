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
import { expect, test, vi } from 'vitest';
import RecipeStatus from '/@/lib/RecipeStatus.svelte';
import type { Recipe } from '@shared/src/models/IRecipe';
import { studioClient } from '/@/utils/client';

vi.mock('../utils/client', async () => ({
  studioClient: {
    cloneApplication: vi.fn(),
  },
}));

test('download icon should be visible when localPath is undefined', async () => {
  render(RecipeStatus, {
    recipe: {} as unknown as Recipe,
    localRepository: undefined,
  });

  const icon = screen.getByLabelText('download icon');
  expect(icon).toBeDefined();
});

test('chevron down icon should be visible when localPath is defined', async () => {
  render(RecipeStatus, {
    recipe: {} as unknown as Recipe,
    localRepository: {
      labels: {},
      path: 'random-path',
      sourcePath: 'random-source-path',
    },
  });

  const icon = screen.getByLabelText('chevron down icon');
  expect(icon).toBeDefined();
});

test('click on download icon should call cloneApplication', async () => {
  vi.mocked(studioClient.cloneApplication).mockResolvedValue(undefined);

  render(RecipeStatus, {
    recipe: {
      id: 'dummy-recipe-id',
    } as unknown as Recipe,
    localRepository: undefined,
  });

  const button = screen.getByRole('button');
  await fireEvent.click(button);

  await vi.waitFor(() => {
    expect(studioClient.cloneApplication).toHaveBeenCalledWith('dummy-recipe-id');
  });
});
