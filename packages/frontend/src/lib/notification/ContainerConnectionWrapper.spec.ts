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

import { render } from '@testing-library/svelte';
import { studioClient } from '../../utils/client';
import ContainerConnectionWrapper from '/@/lib/notification/ContainerConnectionWrapper.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { VMType } from '@shared/src/models/IPodman';

vi.mock('../../utils/client', async () => ({
  studioClient: {
    checkContainerConnectionStatusAndResources: vi.fn(),
    getExtensionConfiguration: vi.fn(),
  },
  rpcBrowser: {
    subscribe: (): unknown => {
      return {
        unsubscribe: (): void => {},
      };
    },
  },
}));

const modelMock: ModelInfo = {
  name: 'Dummy',
  description: '',
  properties: {},
  id: 'dummy-model-id',
};

const connection: ContainerProviderConnectionInfo = {
  status: 'started',
  name: 'Podman machine',
  type: 'podman',
  providerId: 'podman',
  vmType: VMType.QEMU,
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue({
    name: 'Podman',
    canRedirect: false,
    status: 'running',
  });
  vi.mocked(studioClient.getExtensionConfiguration).mockResolvedValue({
    experimentalGPU: false,
    apiPort: 0,
    experimentalTuning: false,
    modelsPath: '',
    modelUploadDisabled: false,
  });
});

test('model without memory should not check for status', async () => {
  render(ContainerConnectionWrapper, {
    model: modelMock,
    containerProviderConnection: connection,
  });
  expect(studioClient.checkContainerConnectionStatusAndResources).not.toHaveBeenCalled();
});

test('model with memory should check for status', async () => {
  const memoryModel = { ...modelMock, memory: 1024 };
  render(ContainerConnectionWrapper, {
    model: memoryModel,
    containerProviderConnection: connection,
  });
  expect(studioClient.checkContainerConnectionStatusAndResources).toHaveBeenCalledWith({
    connection: connection,
    model: memoryModel,
    context: 'inference',
  });
});

test('context should be propagated', async () => {
  const memoryModel = { ...modelMock, memory: 1024 };
  render(ContainerConnectionWrapper, {
    model: memoryModel,
    containerProviderConnection: connection,
    checkContext: 'recipe',
  });
  expect(studioClient.checkContainerConnectionStatusAndResources).toHaveBeenCalledWith({
    connection: connection,
    model: memoryModel,
    context: 'recipe',
  });
});
