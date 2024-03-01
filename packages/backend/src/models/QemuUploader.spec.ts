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
import * as utils from '../utils/podman';
import { beforeEach } from 'node:test';
import { QemuUploader } from './QemuUploader';

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

const qemuUploader = new QemuUploader();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('canUpload', () => {
  test('should return false if system is not qemu', async () => {
    const machine: utils.MachineJSON = {
      Name: 'machine',
      CPUs: 2,
      Memory: '2000',
      DiskSize: '100',
      Running: true,
      Starting: false,
      Default: true,
      VMType: 'WSL',
    };
    vi.spyOn(utils, 'getFirstRunningMachine').mockResolvedValue(machine);
    const result = await qemuUploader.canUpload();
    expect(result).toBeFalsy();
  });
  test('should return true if system is qemu', async () => {
    const machine: utils.MachineJSON = {
      Name: 'machine',
      CPUs: 2,
      Memory: '2000',
      DiskSize: '100',
      Running: true,
      Starting: false,
      Default: true,
      VMType: 'qemu',
    };
    vi.spyOn(utils, 'getFirstRunningMachine').mockResolvedValue(machine);
    const result = await qemuUploader.canUpload();
    expect(result).toBeTruthy();
  });
});

describe('upload', () => {
  const machine: utils.MachineJSON = {
    Name: 'machine',
    CPUs: 2,
    Memory: '2000',
    DiskSize: '100',
    Running: true,
    Starting: false,
    Default: true,
  };
  vi.spyOn(utils, 'getPodmanCli').mockReturnValue('podman');
  vi.spyOn(utils, 'getFirstRunningMachine').mockResolvedValue(machine);
  test('throw if localpath is not defined', async () => {
    await expect(qemuUploader.upload('')).rejects.toThrowError('invalid local path');
  });
  test('copy model if not exists on podman machine', async () => {
    mocks.execMock.mockRejectedValueOnce('error');
    await qemuUploader.upload('/home/user/folder/file');
    expect(mocks.execMock).toBeCalledWith('podman', ['machine', 'ssh', 'machine', 'stat', '/var/home/core/file']);
  });
  test('do not copy model if it exists on podman machine', async () => {
    mocks.execMock.mockResolvedValue('');
    await qemuUploader.upload('/home/user/folder/file');
    expect(mocks.execMock).toBeCalledWith('podman', ['machine', 'ssh', 'machine', 'stat', '/var/home/core/file']);
    expect(mocks.execMock).toBeCalledWith('podman', [
      'machine',
      'ssh',
      'machine',
      'cp',
      '/home/user/folder/file',
      '/var/home/core/file',
    ]);
  });
});
