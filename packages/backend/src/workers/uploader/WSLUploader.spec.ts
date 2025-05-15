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

import { expect, test, describe, vi, beforeEach } from 'vitest';
import { WSLUploader } from './WSLUploader';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { configuration, env, process, type ContainerProviderConnection, type RunResult } from '@podman-desktop/api';
import { VMType } from '@shared/models/IPodman';

vi.mock('@podman-desktop/api', () => ({
  env: {
    isWindows: false,
  },
  process: {
    exec: vi.fn(),
  },
  configuration: {
    getConfiguration: vi.fn(),
  },
}));

const connectionMock: ContainerProviderConnection = {
  name: 'machine2',
  type: 'podman',
  status: () => 'started',
  vmType: VMType.WSL,
  endpoint: {
    socketPath: 'socket.sock',
  },
};

const wslUploader = new WSLUploader();

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(configuration.getConfiguration).mockReturnValue({
    get: () => 'podman.exe',
    has: vi.fn(),
    update: vi.fn(),
  });
});

describe('canUpload', () => {
  test('should return false if system is not windows', () => {
    vi.mocked(env).isWindows = false;
    const result = wslUploader.enabled();
    expect(result).toBeFalsy();
  });
  test('should return true if system is windows', () => {
    vi.mocked(env).isWindows = true;
    const result = wslUploader.enabled();
    expect(result).toBeTruthy();
  });
});

describe('upload', () => {
  test('throw if localpath is not defined', async () => {
    await expect(
      wslUploader.perform({
        connection: connectionMock,
        model: {
          file: undefined,
        } as unknown as ModelInfo,
      }),
    ).rejects.toThrowError('model is not available locally.');
  });

  test('non-WSL VMType should return the original path', async () => {
    vi.mocked(process.exec).mockRejectedValueOnce('error');
    const result = await wslUploader.perform({
      connection: {
        ...connectionMock,
        vmType: VMType.UNKNOWN,
      },
      model: {
        id: 'dummyId',
        file: { path: 'C:\\Users\\podman\\folder', file: 'dummy.guff' },
      } as unknown as ModelInfo,
    });
    expect(process.exec).not.toHaveBeenCalled();
    expect(result.startsWith('C:\\Users\\podman\\folder')).toBeTruthy();
  });

  test('copy model if not exists on podman machine', async () => {
    vi.mocked(process.exec).mockRejectedValueOnce('error');
    await wslUploader.perform({
      connection: connectionMock,
      model: {
        id: 'dummyId',
        file: { path: 'C:\\Users\\podman\\folder', file: 'dummy.guff' },
      } as unknown as ModelInfo,
    });
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'stat',
      '/home/user/ai-lab/models/dummyId',
    ]);
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'mkdir',
      '-p',
      '/home/user/ai-lab/models',
    ]);
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'cp',
      '-r',
      '/mnt/c/Users/podman/folder/dummy.guff',
      '/home/user/ai-lab/models/dummyId',
    ]);
  });

  test('copy model if not exists on podman machine with space handling', async () => {
    vi.mocked(process.exec).mockRejectedValueOnce('error');
    await wslUploader.perform({
      connection: connectionMock,
      model: {
        id: 'dummyId',
        file: { path: 'C:\\Users\\podman folder', file: 'dummy.guff' },
      } as unknown as ModelInfo,
    });
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'stat',
      '/home/user/ai-lab/models/dummyId',
    ]);
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'mkdir',
      '-p',
      '/home/user/ai-lab/models',
    ]);
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'cp',
      '-r',
      '/mnt/c/Users/podman\\ folder/dummy.guff',
      '/home/user/ai-lab/models/dummyId',
    ]);
  });

  test('do not copy model if it exists on podman machine', async () => {
    vi.mocked(process.exec).mockResolvedValue({} as RunResult);
    await wslUploader.perform({
      connection: connectionMock,
      model: {
        id: 'dummyId',
        file: { path: 'C:\\Users\\podman\\folder', file: 'dummy.guff' },
      } as unknown as ModelInfo,
    });
    expect(process.exec).toBeCalledWith('podman.exe', [
      'machine',
      'ssh',
      'machine2',
      'stat',
      '/home/user/ai-lab/models/dummyId',
    ]);
    expect(process.exec).toBeCalledTimes(1);
  });
});
