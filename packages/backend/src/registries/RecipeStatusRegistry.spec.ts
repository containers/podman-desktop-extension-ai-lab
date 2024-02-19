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
import { expect, test, vi, beforeEach } from 'vitest';
import type { TaskRegistry } from './TaskRegistry';
import type { Webview } from '@podman-desktop/api';
import { RecipeStatusRegistry } from './RecipeStatusRegistry';
import { MSG_NEW_RECIPE_STATE } from '@shared/Messages';

const mocks = vi.hoisted(() => ({
  setMock: vi.fn(),
  postMessageMock: vi.fn(),
}));

const taskRegistry = {
  set: mocks.setMock,
} as unknown as TaskRegistry;

const webview = {
  postMessage: mocks.postMessageMock,
} as unknown as Webview;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.postMessageMock.mockResolvedValue(undefined);
});

test('recipe status registry should start without any statuses', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  expect(recipeStatusRegistry.getStatuses().length).toBe(0);
});

test('taskRegistry should have been updated', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', 'random-model', {
    recipeId: 'random',
    modelId: 'random-model',
    tasks: [
      {
        id: 'task-1',
        name: 'task-1',
        state: 'loading',
      },
    ],
  });
  expect(recipeStatusRegistry.getStatuses().length).toBe(1);
  expect(mocks.setMock).toHaveBeenNthCalledWith(1, {
    id: 'task-1',
    name: 'task-1',
    state: 'loading',
  });
});

test('webview should have been notified', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', 'random-model', {
    recipeId: 'random',
    modelId: 'random-model',
    tasks: [],
  });
  expect(mocks.postMessageMock).toHaveBeenNthCalledWith(1, {
    id: MSG_NEW_RECIPE_STATE,
    body: [
      {
        recipeId: 'random',
        modelId: 'random-model',
        tasks: [],
      },
    ],
  });
});

test('recipe status should have been updated', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', 'random-model', {
    recipeId: 'random',
    modelId: 'random-model',
    tasks: [
      {
        id: 'task-',
        name: 'task-1',
        state: 'loading',
      },
    ],
  });
  const statuses = recipeStatusRegistry.getStatuses();
  expect(statuses.length).toBe(1);
  expect(statuses.find(s => s.recipeId === 'random' && s.modelId === 'random-model').tasks.length).toBe(1);
});
