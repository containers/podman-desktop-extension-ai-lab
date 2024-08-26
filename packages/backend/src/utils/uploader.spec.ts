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

import { expect, test, describe, vi } from 'vitest';
import { WSLUploader } from '../workers/uploader/WSLUploader';
import * as podmanDesktopApi from '@podman-desktop/api';
import { beforeEach } from 'node:test';
import { Uploader } from './uploader';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ContainerProviderConnection } from '@podman-desktop/api';
import { VMType } from '@shared/src/models/IPodman';

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      isWindows: false,
    },
    process: {
      exec: vi.fn(),
    },
    EventEmitter: vi.fn().mockImplementation(() => {
      return {
        fire: vi.fn(),
      };
    }),
  };
});

const connectionMock: ContainerProviderConnection = {
  name: 'machine2',
  type: 'podman',
  status: () => 'started',
  vmType: VMType.WSL,
  endpoint: {
    socketPath: 'socket.sock',
  },
};

const uploader = new Uploader(connectionMock, {
  id: 'dummyModelId',
  file: {
    file: 'dummyFile.guff',
    path: 'localpath',
  },
} as unknown as ModelInfo);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('perform', () => {
  test('should return localModelPath if no workers for current system', async () => {
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    const result = await uploader.perform('id');
    expect(result.startsWith('localpath')).toBeTruthy();
  });
  test('should return remote path if there is a worker for current system', async () => {
    vi.spyOn(WSLUploader.prototype, 'perform').mockResolvedValue('remote');
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    const result = await uploader.perform('id');
    expect(result).toBe('remote');
  });
});
