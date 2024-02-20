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
import { WSLUploader } from './WSLUploader';
import * as podmanDesktopApi from '@podman-desktop/api';
import { beforeEach } from 'node:test';
import { Uploader } from './uploader';

const mocks = vi.hoisted(() => {
  return {
    execMock: vi.fn(),
  };
});

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      isWindows: false,
    },
    process: {
      exec: mocks.execMock,
    },
    EventEmitter: vi.fn().mockImplementation(() => {
      return {
        fire: vi.fn(),
      };
    }),
  };
});
const uploader = new Uploader('localpath');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('perform', () => {
  test('should return localModelPath if no workers for current system', async () => {
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    const result = await uploader.perform();
    expect(result).toBe('localpath');
  });
  test('should return remote path if there is a worker for current system', async () => {
    vi.spyOn(WSLUploader.prototype, 'upload').mockResolvedValue('remote');
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    const result = await uploader.perform();
    expect(result).toBe('remote');
  });
});
