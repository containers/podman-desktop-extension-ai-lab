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
import { render, screen } from '@testing-library/svelte';
import ServiceColumnModelName from '/@/lib/table/service/ServiceColumnModelName.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

beforeEach(() => {
  vi.resetAllMocks();
});

test('the model name should be displayed', async () => {
  render(ServiceColumnModelName, {
    object: {
      health: undefined,
      models: [
        {
          name: 'dummyName',
        } as unknown as ModelInfo,
      ],
      connection: { port: 8888 },
      status: 'running',
      container: { containerId: 'dummyContainerId', engineId: 'dummyEngineId' },
    },
  });

  const modelName = screen.getByText('dummyName');
  expect(modelName).toBeDefined();
});
