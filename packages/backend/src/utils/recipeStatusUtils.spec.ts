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
import { expect, test, vi } from 'vitest';
import { RecipeStatusUtils } from './recipeStatusUtils';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';

const mocks = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
}));

const recipeStatusRegistryMock = {
  setStatus: mocks.setStatusMock,
} as unknown as RecipeStatusRegistry;

test('Ensure only the first error is kept', () => {
  const tasksUtils = new RecipeStatusUtils('random-1', recipeStatusRegistryMock);
  tasksUtils.setTask({
    id: 'dummy',
    error: 'first',
    name: 'dummy',
    state: 'error',
  });

  tasksUtils.setTaskError('dummy', 'second');
  const tasks = tasksUtils.toRecipeStatus().tasks;
  expect(tasks.length).toBe(1);
  expect(tasks[0].error).toBe('first');
});
