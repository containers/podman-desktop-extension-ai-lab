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

import { beforeEach, expect, test, vi } from 'vitest';
import { checkContainerConnectionStatus } from './connectionUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { studioClient } from './client';
import type { ContainerConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';

vi.mock('./client', async () => {
  return {
    studioClient: {
      checkContainerConnectionStatusAndResources: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

const localModels = [{ id: 'model-id', memory: 10 } as ModelInfo, { id: 'model-id-2', memory: 10 } as ModelInfo];

test('checkContainerConnectionStatus should return undefined if checkContainerConnectionStatusAndResources fails', async () => {
  vi.spyOn(studioClient, 'checkContainerConnectionStatusAndResources').mockRejectedValue('');
  const result = await checkContainerConnectionStatus(localModels, 'model-id', 'inference');
  expect(result).toBeUndefined();
});

test('checkContainerConnectionStatus should return undefined if model is not in localModels', async () => {
  vi.spyOn(studioClient, 'checkContainerConnectionStatusAndResources').mockRejectedValue('');
  const result = await checkContainerConnectionStatus(localModels, 'unknown-model', 'inference');
  expect(result).toBeUndefined();
});

test('checkContainerConnectionStatus should return checkContainerConnectionStatusAndResources result', async () => {
  const connectionInfo: ContainerConnectionInfo = {
    status: 'no-machine',
    canRedirect: true,
  };
  vi.spyOn(studioClient, 'checkContainerConnectionStatusAndResources').mockResolvedValue(connectionInfo);
  const result = await checkContainerConnectionStatus(localModels, 'model-id', 'inference');
  expect(result).toStrictEqual(connectionInfo);
});
