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
import { render, screen, fireEvent } from '@testing-library/svelte';
import { router } from 'tinro';
import ServiceColumnName from '/@/lib/table/service/ServiceColumnName.svelte';

beforeEach(() => {
  vi.resetAllMocks();
});

test('click on name should open details page', async () => {
  const gotoMock = vi.spyOn(router, 'goto');
  render(ServiceColumnName, {
    object: {
      health: undefined,
      models: [],
      connection: { port: 8888 },
      status: 'running',
      container: { containerId: 'dummyContainerId', engineId: 'dummyEngineId' },
    },
  });

  const nameBtn = screen.getByTitle('Open service details');
  expect(nameBtn).toBeDefined();
  await fireEvent.click(nameBtn);

  expect(gotoMock).toHaveBeenCalledWith('/service/dummyContainerId');
});
