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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { type ContainerProviderConnection, type Webview, process, env } from '@podman-desktop/api';
import { GPUManager } from './GPUManager';
import { graphics, type Systeminformation } from 'systeminformation';
import {
  type ContainerDeviceInterface,
  GPUVendor,
  type IGPUInfo,
  type NvidiaCTKVersion,
} from '@shared/src/models/IGPUInfo';
import type { PodmanConnection } from './podmanConnection';
import { readFile, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';

vi.mock('../utils/inferenceUtils', () => ({
  getProviderContainerConnection: vi.fn(),
  getImageInfo: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      isWindows: false,
      isLinux: false,
      isMac: false,
    },
    process: {
      exec: vi.fn(),
    },
  };
});

vi.mock('systeminformation', () => ({
  graphics: vi.fn(),
}));

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

const podmanConnectionMock: PodmanConnection = {
  executeSSH: vi.fn(),
} as unknown as PodmanConnection;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(true);

  (env.isLinux as boolean) = false;
  (env.isWindows as boolean) = false;
  (env.isMac as boolean) = false;
});

test('post constructor should have no items', () => {
  const manager = new GPUManager(webviewMock, podmanConnectionMock);
  expect(manager.getAll().length).toBe(0);
});

test('no controller should return empty array', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [],
    displays: [],
  });

  const manager = new GPUManager(webviewMock, podmanConnectionMock);
  expect(await manager.collectGPUs()).toHaveLength(0);
});

test('intel controller should return intel vendor', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [
      {
        vendor: 'Intel Corporation',
        model: 'intel model',
        vram: 1024,
      } as unknown as Systeminformation.GraphicsControllerData,
    ],
    displays: [],
  });

  const manager = new GPUManager(webviewMock, podmanConnectionMock);
  expect(await manager.collectGPUs()).toStrictEqual([
    {
      vendor: GPUVendor.INTEL,
      model: 'intel model',
      vram: 1024,
    },
  ]);
});

test('NVIDIA controller should return intel vendor', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [
      {
        vendor: 'NVIDIA',
        model: 'NVIDIA GeForce GTX 1060 6GB',
        vram: 6144,
      } as unknown as Systeminformation.GraphicsControllerData,
    ],
    displays: [],
  });

  const manager = new GPUManager(webviewMock, podmanConnectionMock);
  expect(await manager.collectGPUs()).toStrictEqual([
    {
      vendor: GPUVendor.NVIDIA,
      model: 'NVIDIA GeForce GTX 1060 6GB',
      vram: 6144,
    },
  ]);
});

class GPUManagerTest extends GPUManager {
  public override parseNvidiaCTKVersion(stdout: string): NvidiaCTKVersion {
    return super.parseNvidiaCTKVersion(stdout);
  }

  public override async getNvidiaContainerToolKitVersion(
    connection: ContainerProviderConnection,
  ): Promise<NvidiaCTKVersion> {
    return super.getNvidiaContainerToolKitVersion(connection);
  }

  public override parseNvidiaCDI(stdout: string): ContainerDeviceInterface {
    return super.parseNvidiaCDI(stdout);
  }

  public override async getNvidiaCDI(connection: ContainerProviderConnection): Promise<ContainerDeviceInterface> {
    return super.getNvidiaCDI(connection);
  }

  public override getAll(): IGPUInfo[] {
    return [
      {
        vendor: GPUVendor.NVIDIA,
        model: 'demo-model',
        vram: 555,
      },
    ];
  }
}

const NVIDIA_CTK_VERSION = `NVIDIA Container Toolkit CLI version 1.16.1\ncommit: a470818ba7d9166be282cd0039dd2fc9b0a34d73`;

describe('parseNvidiaCTKVersion', () => {
  test('valid stdout', () => {
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { version, commit } = manager.parseNvidiaCTKVersion(NVIDIA_CTK_VERSION);
    expect(version).toBe('1.16.1');
    expect(commit).toBe('a470818ba7d9166be282cd0039dd2fc9b0a34d73');
  });

  test('empty stdout', () => {
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    expect(() => {
      manager.parseNvidiaCTKVersion('');
    }).toThrowError('malformed version output');
  });
});

const NVIDIA_CDI = `
---
cdiVersion: 0.3.0
devices:
- containerEdits:
    deviceNodes:
    - path: /dev/dxg
  name: all
kind: nvidia.com/gpu
`;

describe('parseNvidiaCDI', () => {
  test('valid stdout', () => {
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { cdiVersion, devices, kind } = manager.parseNvidiaCDI(NVIDIA_CDI);
    expect(cdiVersion).toBe('0.3.0');
    expect(devices).toStrictEqual([
      {
        containerEdits: {
          deviceNodes: [
            {
              path: '/dev/dxg',
            },
          ],
        },
        name: 'all',
      },
    ]);
    expect(kind).toBe('nvidia.com/gpu');
  });

  test('empty stdout', () => {
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    expect(() => {
      manager.parseNvidiaCDI('');
    }).toThrowError('malformed output nvidia CDI output');
  });
});

describe('getNvidiaContainerToolKitVersion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(podmanConnectionMock.executeSSH).mockResolvedValue({
      stdout: NVIDIA_CTK_VERSION,
      stderr: '',
      command: '',
    });
    vi.mocked(process.exec).mockResolvedValue({
      stdout: NVIDIA_CTK_VERSION,
      stderr: '',
      command: '',
    });
  });

  test('windows wsl connection should use executeSSH', async () => {
    (env.isWindows as boolean) = true;
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { version, commit } = await manager.getNvidiaContainerToolKitVersion(WSL_CONNECTION);
    expect(version).toBe('1.16.1');
    expect(commit).toBe('a470818ba7d9166be282cd0039dd2fc9b0a34d73');

    expect(podmanConnectionMock.executeSSH).toHaveBeenCalledWith(WSL_CONNECTION, ['nvidia-ctk', '--quiet', '-v']);
    expect(process.exec).not.toHaveBeenCalled();
  });

  test('connection without vmType on non-linux system should throw an error', async () => {
    (env.isLinux as boolean) = false;
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    await expect(async () => {
      await manager.getNvidiaContainerToolKitVersion(NATIVE_CONNECTION);
    }).rejects.toThrowError('cannot determine the environment to execute nvidia-ctk');
  });

  test('linux with native connection should execute nvidia-ctk on host', async () => {
    (env.isLinux as boolean) = true;

    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { version, commit } = await manager.getNvidiaContainerToolKitVersion(NATIVE_CONNECTION);
    expect(version).toBe('1.16.1');
    expect(commit).toBe('a470818ba7d9166be282cd0039dd2fc9b0a34d73');

    expect(process.exec).toHaveBeenCalledWith('nvidia-ctk', ['--quiet', '-v']);
    expect(podmanConnectionMock.executeSSH).not.toHaveBeenCalled();
  });
});

const NATIVE_CONNECTION: ContainerProviderConnection = {
  status: () => 'started',
  vmType: undefined,
  name: 'podman',
  type: 'podman',
} as unknown as ContainerProviderConnection;

const WSL_CONNECTION: ContainerProviderConnection = {
  status: () => 'started',
  vmType: 'wsl',
  name: 'podman',
  type: 'podman',
} as unknown as ContainerProviderConnection;

describe('getNvidiaCDI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(podmanConnectionMock.executeSSH).mockResolvedValue({
      stdout: NVIDIA_CDI,
      stderr: '',
      command: '',
    });
  });

  test('windows wsl connection should use executeSSH', async () => {
    (env.isWindows as boolean) = true;
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { kind } = await manager.getNvidiaCDI(WSL_CONNECTION);
    expect(kind).toBe('nvidia.com/gpu');
    expect(podmanConnectionMock.executeSSH).toHaveBeenCalledWith(WSL_CONNECTION, ['cat', '/etc/cdi/nvidia.yaml']);
    expect(stat).not.toHaveBeenCalled();
  });

  test('connection without vmType on non-linux system should throw an error', async () => {
    (env.isLinux as boolean) = false;
    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    await expect(async () => {
      await manager.getNvidiaCDI(NATIVE_CONNECTION);
    }).rejects.toThrowError('cannot determine the environment to read nvidia CDI file');
  });

  test('linux with native connection should read config on host', async () => {
    (env.isLinux as boolean) = true;
    vi.mocked(stat).mockResolvedValue({
      isFile: () => true,
    } as Stats);
    vi.mocked(readFile).mockResolvedValue(NVIDIA_CDI);

    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);
    const { kind } = await manager.getNvidiaCDI(NATIVE_CONNECTION);
    expect(kind).toBe('nvidia.com/gpu');
    // on native linux we should not ssh in the machine
    expect(podmanConnectionMock.executeSSH).not.toHaveBeenCalled();
    expect(stat).toHaveBeenCalledWith('/etc/cdi/nvidia.yaml');
    expect(readFile).toHaveBeenCalledWith('/etc/cdi/nvidia.yaml', { encoding: 'utf8' });
  });

  test('linux with native connection should throw an error if file does not exists', async () => {
    (env.isLinux as boolean) = true;
    vi.mocked(stat).mockRejectedValue(new Error('file do not exists'));

    const manager = new GPUManagerTest(webviewMock, podmanConnectionMock);

    await expect(async () => {
      await manager.getNvidiaCDI(NATIVE_CONNECTION);
    }).rejects.toThrowError('file do not exists');

    expect(readFile).not.toHaveBeenCalled();
  });
});
