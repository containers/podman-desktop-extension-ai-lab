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
import type { InferenceServer } from '@shared/src/models/IInference';
import InferenceServerDetails from '/@/pages/InferenceServerDetails.svelte';

const mocks = vi.hoisted(() => {
  return {
    getInferenceServersMock: vi.fn(),
  };
});

vi.mock('../stores/inferenceServers', () => ({
  inferenceServers: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.getInferenceServersMock());
      return () => {};
    },
  },
}));

vi.mock('../utils/client', async () => {
  return {
    studioClient: {},
  };
});

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getInferenceServersMock.mockReturnValue([
    {
      health: undefined,
      models: [],
      connection: { port: 9999 },
      status: 'running',
      container: {
        containerId: 'dummyContainerId',
        engineId: 'dummyEngineId',
      },
    } as InferenceServer,
  ]);
});

test('ensure address is displayed', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const address = screen.getByText('http://localhost:9999/v1');
  expect(address).toBeDefined();
});
