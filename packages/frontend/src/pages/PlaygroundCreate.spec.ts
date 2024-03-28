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
import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { studioClient } from '../utils/client';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import * as tasksStore from '/@/stores/tasks';
import * as modelsInfoStore from '/@/stores/modelsInfo';
import type { Task } from '@shared/src/models/ITask';
import PlaygroundCreate from './PlaygroundCreate.svelte';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      requestCreatePlayground: vi.fn(),
    },
    rpcBrowser: {
      subscribe: () => {
        return {
          unsubscribe: () => {},
        };
      },
    },
  };
});

vi.mock('/@/stores/tasks', async () => {
  return {
    tasks: vi.fn(),
  };
});

vi.mock('/@/stores/modelsInfo', async () => {
  return {
    modelsInfo: vi.fn(),
  };
});

test('should display error message if createPlayground fails', async () => {
  const tasksList = writable<Task[]>([]);
  vi.mocked(tasksStore).tasks = tasksList;

  const modelsInfoList = writable<ModelInfo[]>([
    {
      id: 'id',
      file: {
        file: 'file',
        path: '/tmp/path',
      },
    } as unknown as ModelInfo,
  ]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;

  vi.mocked(studioClient.requestCreatePlayground).mockRejectedValue('error creating playground');

  render(PlaygroundCreate);

  const errorMessage = screen.queryByLabelText('Error Message Content');
  expect(errorMessage).not.toBeInTheDocument();

  const createButton = screen.getByTitle('Create playground');
  await userEvent.click(createButton);

  const errorMessageAfterSubmit = screen.queryByLabelText('Error Message Content');
  expect(errorMessageAfterSubmit).toBeInTheDocument();
  expect(errorMessageAfterSubmit?.textContent).equal('error creating playground');
});
