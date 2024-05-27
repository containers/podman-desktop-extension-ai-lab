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
import { expect, test, vi, beforeEach, describe } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/svelte';
import { studioClient } from '../utils/client';
import ApplicationActions from '/@/lib/ApplicationActions.svelte';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import { router } from 'tinro';

vi.mock('../utils/client', async () => ({
  studioClient: {
    requestStopApplication: vi.fn(),
    requestStartApplication: vi.fn(),
    requestRemoveApplication: vi.fn(),
    requestRestartApplication: vi.fn(),
    requestOpenApplication: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.requestStopApplication).mockResolvedValue(undefined);
  vi.mocked(studioClient.requestStartApplication).mockResolvedValue(undefined);
  vi.mocked(studioClient.requestRemoveApplication).mockResolvedValue(undefined);
  vi.mocked(studioClient.requestRestartApplication).mockResolvedValue(undefined);
  vi.mocked(studioClient.requestOpenApplication).mockResolvedValue(undefined);
});

test('deletion action should call requestRemoveApplication', async () => {
  render(ApplicationActions, {
    object: {
      pod: {
        Containers: [],
      },
    } as unknown as ApplicationState,
    recipeId: 'dummy-recipe-id',
    modelId: 'dummy-model-id',
  });

  const deleteBtn = screen.getByTitle('Delete AI App');
  expect(deleteBtn).toBeVisible();

  await fireEvent.click(deleteBtn);
  expect(studioClient.requestRemoveApplication).toHaveBeenCalledWith('dummy-recipe-id', 'dummy-model-id');
});

describe('open action', () => {
  test('open action should call requestOpenApplication', async () => {
    render(ApplicationActions, {
      object: {
        pod: {
          Containers: [
            {
              Status: 'running',
            },
          ],
        },
      } as unknown as ApplicationState,
      recipeId: 'dummy-recipe-id',
      modelId: 'dummy-model-id',
    });

    const openBtn = screen.getByTitle('Open AI App');
    expect(openBtn).toBeVisible();

    await fireEvent.click(openBtn);
    expect(studioClient.requestOpenApplication).toHaveBeenCalledWith('dummy-recipe-id', 'dummy-model-id');
  });

  test('open action should not be visible when all container exited', async () => {
    render(ApplicationActions, {
      object: {
        pod: {
          Containers: [
            {
              Status: 'exited',
            },
          ],
        },
      } as unknown as ApplicationState,
      recipeId: 'dummy-recipe-id',
      modelId: 'dummy-model-id',
    });

    const openBtn = screen.queryByTitle('Open AI App');
    expect(openBtn).toBeNull();
  });
});

describe('start action', () => {
  test('start action should be visible when all container exited', async () => {
    render(ApplicationActions, {
      object: {
        pod: {
          Containers: [
            {
              Status: 'exited',
            },
          ],
        },
      } as unknown as ApplicationState,
      recipeId: 'dummy-recipe-id',
      modelId: 'dummy-model-id',
    });

    const startBtn = screen.getByTitle('Start AI App');
    expect(startBtn).toBeDefined();

    await fireEvent.click(startBtn);
    expect(studioClient.requestStartApplication).toHaveBeenCalledWith('dummy-recipe-id', 'dummy-model-id');
  });

  test('start action should be hidden when one container is not exited', async () => {
    render(ApplicationActions, {
      object: {
        pod: {
          Containers: [
            {
              Status: 'exited',
            },
            {
              Status: 'running',
            },
          ],
        },
      } as unknown as ApplicationState,
      recipeId: 'dummy-recipe-id',
      modelId: 'dummy-model-id',
    });

    const startBtn = screen.queryByTitle('Start AI App');
    expect(startBtn).toBeNull();
  });
});

test('restart action should call requestRestartApplication', async () => {
  render(ApplicationActions, {
    object: {
      pod: {
        Containers: [],
      },
    } as unknown as ApplicationState,
    recipeId: 'dummy-recipe-id',
    modelId: 'dummy-model-id',
  });

  const restartBtn = screen.getByTitle('Restart AI App');
  expect(restartBtn).toBeVisible();

  await fireEvent.click(restartBtn);
  expect(studioClient.requestRestartApplication).toHaveBeenCalledWith('dummy-recipe-id', 'dummy-model-id');
});

test('open recipe action should redirect to recipe page', async () => {
  const routerSpy = vi.spyOn(router, 'goto');
  render(ApplicationActions, {
    object: {
      pod: {
        Containers: [],
      },
    } as unknown as ApplicationState,
    recipeId: 'dummy-recipe-id',
    modelId: 'dummy-model-id',
    enableGoToRecipeAction: true,
  });

  const openRecipeBtn = screen.getByTitle('Open Recipe');
  expect(openRecipeBtn).toBeVisible();

  await fireEvent.click(openRecipeBtn);
  expect(routerSpy).toHaveBeenCalledWith('/recipe/dummy-recipe-id');
});

test('open recipe action should not be visible by default', async () => {
  render(ApplicationActions, {
    object: {
      pod: {
        Containers: [],
      },
    } as unknown as ApplicationState,
    recipeId: 'dummy-recipe-id',
    modelId: 'dummy-model-id',
  });

  const openRecipeBtn = screen.getByTitle('Open Recipe');
  expect(openRecipeBtn).toHaveClass('hidden');
});
