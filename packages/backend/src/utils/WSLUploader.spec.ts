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
import * as utils from './podman';
import { beforeEach } from 'node:test';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const mocks = vi.hoisted(() => {
  return {
    execMock: vi.fn(),
  };
});

vi.mock('@podman-desktop/api', () => ({
  env: {
    isWindows: false,
  },
  process: {
    exec: mocks.execMock,
  },
}));

const wslUploader = new WSLUploader();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('canUpload', () => {
  test('should return false if system is not windows', () => {
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    const result = wslUploader.canUpload();
    expect(result).toBeFalsy();
  });
  test('should return true if system is windows', () => {
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    const result = wslUploader.canUpload();
    expect(result).toBeTruthy();
  });
});

describe('upload', () => {
  vi.spyOn(utils, 'getPodmanCli').mockReturnValue('podman');
  vi.spyOn(utils, 'getFirstRunningPodmanConnection').mockResolvedValue({
    connection: {
      name: 'test',
      status: vi.fn(),
      endpoint: {
        socketPath: '/endpoint.sock',
      },
      type: 'podman',
    },
    providerId: 'podman',
  });
  test('throw if localpath is not defined', async () => {
    await expect(
      wslUploader.upload({
        file: undefined,
      } as unknown as ModelInfo),
    ).rejects.toThrowError('model is not available locally.');
  });
  test('copy model if not exists on podman machine', async () => {
    mocks.execMock.mockRejectedValueOnce('error');
    vi.spyOn(utils, 'getFirstRunningMachineName').mockReturnValue('machine2');
    await wslUploader.upload({
      id: 'dummyId',
      file: { path: 'C:\\Users\\podman\\folder', file: 'dummy.guff' },
    } as unknown as ModelInfo);
    expect(mocks.execMock).toBeCalledWith('podman', [
      'machine',
      'ssh',
      'machine2',
      'stat',
      '/home/user/ai-lab/models/dummy.guff',
    ]);
    expect(mocks.execMock).toBeCalledWith('podman', [
      'machine',
      'ssh',
      'machine2',
      'mkdir',
      '-p',
      '/home/user/ai-lab/models/',
    ]);
    expect(mocks.execMock).toBeCalledWith('podman', [
      'machine',
      'ssh',
      'machine2',
      'cp',
      '/mnt/c/Users/podman/folder/dummy.guff',
      '/home/user/ai-lab/models/dummy.guff',
    ]);
    mocks.execMock.mockClear();
  });
  test('do not copy model if it exists on podman machine', async () => {
    mocks.execMock.mockResolvedValue('');
    vi.spyOn(utils, 'getFirstRunningMachineName').mockReturnValue('machine2');
    await wslUploader.upload({
      id: 'dummyId',
      file: { path: 'C:\\Users\\podman\\folder', file: 'dummy.guff' },
    } as unknown as ModelInfo);
    expect(mocks.execMock).toBeCalledWith('podman', [
      'machine',
      'ssh',
      'machine2',
      'stat',
      '/home/user/ai-lab/models/dummy.guff',
    ]);
    expect(mocks.execMock).toBeCalledTimes(1);
    mocks.execMock.mockClear();
  });
});
