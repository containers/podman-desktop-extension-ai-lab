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
import { screen, render } from '@testing-library/svelte';
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';
import ModelColumnRecipeRecommended from './ModelColumnRecipeRecommended.svelte';

test('expect the star icon to be rendered whn recipe is recommended', async () => {
  render(ModelColumnRecipeRecommended, {
    object: {
      id: 'id',
      inUse: false,
      recommended: true,
    } as RecipeModelInfo,
  });

  const starIcon = screen.getByTitle('Recommended model');
  expect(starIcon).toBeInTheDocument();
});

test('expect nothing when recipe is NOT recommended', async () => {
  render(ModelColumnRecipeRecommended, {
    object: {
      id: 'id',
      inUse: false,
      recommended: false,
    } as RecipeModelInfo,
  });

  const starIcon = screen.queryByTitle('Recommended model');
  expect(starIcon).not.toBeInTheDocument();
});
