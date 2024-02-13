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
import { vi, test, expect } from 'vitest';
import { screen, render, fireEvent } from '@testing-library/svelte';
import ModelColumnRecipeActions from './ModelColumnRecipeActions.svelte';
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';

const updateMock = vi.fn();

test('expect the setSelectedModel is called when swap button is clicked', async () => {
  const { component } = render(ModelColumnRecipeActions, {
    object: {
      id: 'id',
      inUse: false,
    } as RecipeModelInfo,
  });
  component.$on('update', updateMock);

  const btnSwapModel = screen.getByRole('button', { name: 'Use this model when running application' });

  expect(btnSwapModel).toBeDefined();
  await fireEvent.click(btnSwapModel);

  expect(updateMock).toHaveBeenCalled();
});
