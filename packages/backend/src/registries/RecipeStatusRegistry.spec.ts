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
import type { PodInfo, Webview } from '@podman-desktop/api';
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
});

test('recipe status registry should start without any statuses', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  expect(recipeStatusRegistry.getStatuses().size).toBe(0);
});

test('taskRegistry should have been updated', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', {
    recipeId: 'random',
    state: 'none',
    pod: {} as PodInfo,
    tasks: [
      {
        id: 'task-1',
        name: 'task-1',
        state: 'loading',
      },
    ],
  });
  expect(recipeStatusRegistry.getStatuses().size).toBe(1);
  expect(mocks.setMock).toHaveBeenNthCalledWith(1, {
    id: 'task-1',
    name: 'task-1',
    state: 'loading',
  });
});

test('webview should have been notified', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', {
    recipeId: 'random',
    state: 'none',
    pod: {} as PodInfo,
    tasks: [],
  });
  expect(mocks.postMessageMock).toHaveBeenNthCalledWith(1, {
    id: MSG_NEW_RECIPE_STATE,
    body: new Map([
      [
        'random',
        {
          recipeId: 'random',
          pod: {},
          state: 'none',
          tasks: [],
        },
      ],
    ]),
  });
});

test('recipe status should have been updated', () => {
  const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, webview);
  recipeStatusRegistry.setStatus('random', {
    recipeId: 'random',
    state: 'none',
    pod: {} as PodInfo,
    tasks: [
      {
        id: 'task-1',
        name: 'task-1',
        state: 'loading',
      },
    ],
  });
  let statuses = recipeStatusRegistry.getStatuses();
  expect(statuses.size).toBe(1);
  expect(statuses.get('random').tasks.length).toBe(1);
  expect(statuses.get('random').state).toBe('none');

  // update the recipe state
  recipeStatusRegistry.setRecipeState('random', 'error');
  statuses = recipeStatusRegistry.getStatuses();
  expect(statuses.size).toBe(1);
  expect(statuses.get('random').tasks.length).toBe(1);
  expect(statuses.get('random').state).toBe('error');
});
