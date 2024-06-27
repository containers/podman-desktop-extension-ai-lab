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
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import InferenceServers from '/@/pages/InferenceServers.svelte';
import { type InferenceServerInfo, InferenceType, RuntimeType } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';

const mocks = vi.hoisted(() => ({
  inferenceServersSubscribeMock: vi.fn(),
  inferenceServersMock: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.inferenceServersSubscribeMock());
      return () => {};
    },
  },
}));
vi.mock('../stores/inferenceServers', async () => {
  return {
    inferenceServers: mocks.inferenceServersMock,
  };
});

vi.mock('../utils/client', async () => ({
  studioClient: {
    getInferenceServers: vi.fn(),
    requestDeleteInferenceServer: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inferenceServersSubscribeMock.mockReturnValue([]);
  vi.mocked(studioClient.requestDeleteInferenceServer).mockResolvedValue(undefined);
});

test('no inference servers should display a status message', async () => {
  render(InferenceServers);
  const status = screen.getByRole('status');
  expect(status).toBeInTheDocument();
  expect(status.textContent).toContain('There is no model service. ');

  const table = screen.queryByRole('table');
  expect(table).toBeNull();
});

test('store with inference server should display the table', async () => {
  mocks.inferenceServersSubscribeMock.mockReturnValue([
    {
      id: 'dummyContainerId',
      runtime: RuntimeType.PODMAN,
      health: undefined,
      models: [],
      connection: { host: 'localhost', port: 8888 },
      status: 'running',
      type: InferenceType.NONE,
    },
  ] as InferenceServerInfo[]);
  render(InferenceServers);

  const table = screen.getByRole('table');
  expect(table).toBeInTheDocument();
});

test('create service button should redirect to create page', async () => {
  const gotoSpy = vi.spyOn(router, 'goto');
  render(InferenceServers);
  const createBtn = screen.getByTitle('Create a new model service');
  expect(createBtn).toBeDefined();

  await fireEvent.click(createBtn);
  await vi.waitFor(() => {
    expect(gotoSpy).toHaveBeenCalledWith('/service/create');
  });
});

test('table should have checkbox', async () => {
  mocks.inferenceServersSubscribeMock.mockReturnValue([
    {
      id: 'dummyContainerId',
      runtime: RuntimeType.PODMAN,
      health: undefined,
      models: [],
      connection: { host: 'localhost', port: 8888 },
      status: 'running',
      type: InferenceType.NONE,
    },
  ] as InferenceServerInfo[]);
  render(InferenceServers);

  const checkbox = screen.getByTitle('Toggle service');
  expect(checkbox).toBeInTheDocument();

  const deleteBtn = screen.queryByTitle('Delete selected items');
  expect(deleteBtn).toBeNull();
});

test('delete button should delete selected item', async () => {
  mocks.inferenceServersSubscribeMock.mockReturnValue([
    {
      id: 'dummyContainerId',
      runtime: RuntimeType.PODMAN,
      health: undefined,
      models: [],
      connection: { host: 'localhost', port: 8888 },
      status: 'running',
      type: InferenceType.NONE,
    },
  ] as InferenceServerInfo[]);
  render(InferenceServers);

  const checkbox = screen.getByTitle('Toggle service');
  await fireEvent.click(checkbox);

  const deleteBtn = screen.getByTitle('Delete selected items');
  expect(deleteBtn).toBeInTheDocument();

  await fireEvent.click(deleteBtn);
  expect(studioClient.requestDeleteInferenceServer).toHaveBeenCalledWith('dummyContainerId');
});
