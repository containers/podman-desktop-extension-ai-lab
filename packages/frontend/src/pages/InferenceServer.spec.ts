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
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import InferenceServers from '/@/pages/InferenceServers.svelte';
import type { InferenceServer } from '@shared/src/models/IInference';

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
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inferenceServersSubscribeMock.mockReturnValue([]);
});

test('no inference servers should display a status message', async () => {
  render(InferenceServers);
  const status = screen.getByRole('status');
  expect(status).toBeInTheDocument();
  expect(status.textContent).toBe('There is no services running for now.');

  const table = screen.queryByRole('table');
  expect(table).toBeNull();
});

test('store with inference server should display the table', async () => {
  mocks.inferenceServersSubscribeMock.mockReturnValue([
    {
      health: undefined,
      models: [],
      connection: { port: 8888 },
      status: 'running',
      container: { containerId: 'dummyContainerId', engineId: 'dummyEngineId' },
    },
  ] as InferenceServer[]);
  render(InferenceServers);

  const table = screen.getByRole('table');
  expect(table).toBeInTheDocument();
});
