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

import { vi, beforeEach, test, expect} from 'vitest';
import { studioClient } from '/@/utils/client';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CreateService from '/@/pages/CreateService.svelte';

const mocks = vi.hoisted(() => {
  return {
    modelsInfoSubscribeMock: vi.fn(),
    modelsInfoQueriesMock: {
      subscribe: (f: (msg: any) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return () => {};
      },
    },
  };
});

vi.mock('../stores/modelsInfo', async () => {
  return {
    modelsInfo: mocks.modelsInfoQueriesMock,
  };
});

vi.mock('../utils/client', async () => ({
  studioClient: {
    createInferenceServer: vi.fn(),
  },
}));


beforeEach(() => {
  vi.resetAllMocks();
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  vi.mocked(studioClient.createInferenceServer).mockResolvedValue(undefined);
});

test('create button should be disabled when no model id provided', () => {
  render(CreateService);

  const createBtn = screen.getByTitle('Create service');
  expect(createBtn).toBeDefined();
  expect(createBtn.attributes.getNamedItem('disabled')).toBeTruthy();
});

test('expect error message to be displayed when no model locally', () => {
  render(CreateService);

  const alert = screen.getByRole('alert');
  expect(alert).toBeDefined();
});

test('expect error message to be hidden when models locally', () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{id: 'random', file: true}]);
  render(CreateService);

  const alert = screen.queryByRole('alert');
  expect(alert).toBeNull();
});

test('button click should call createInferenceServer', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{id: 'random', file: true}]);
  render(CreateService);

  const createBtn = screen.getByTitle('Create service');
  await fireEvent.click(createBtn);
  expect(vi.mocked(studioClient.createInferenceServer)).toHaveBeenCalledWith({
    image: 'quay.io/bootsy/playground:v0',
    labels: {},
    modelsInfo: [{id: 'random', file: true}],
    port: 8888,
  });
});
