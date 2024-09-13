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
import { render, screen } from '@testing-library/svelte';
import { studioClient } from '/@/utils/client';
import GPUEnabledMachine from '/@/lib/notification/GPUEnabledMachine.svelte';

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      navigateToResources: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.navigateToResources).mockResolvedValue(undefined);
});

test('should show navigation to resources', async () => {
  render(GPUEnabledMachine);

  const banner = screen.getByLabelText('GPU machine banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Non GPU enabled machine');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `The selected Podman machine is not GPU enabled. On MacOS, you can run GPU workloads using the krunkit\n        environment. Do you want to create a GPU enabled machine ?`,
  );

  const btnUpdate = screen.queryByRole('button', { name: 'Create GPU enabled machine' });
  expect(btnUpdate).toBeInTheDocument();
});
