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

import { describe, expect, test, vi } from 'vitest';
import { PodmanConnection } from './podmanConnection';
import type { RegisterContainerConnectionEvent, RunResult, UpdateContainerConnectionEvent } from '@podman-desktop/api';
import { process } from '@podman-desktop/api';
import { VMType } from '@shared/src/models/IPodman';

const mocks = vi.hoisted(() => ({
  getFirstRunningPodmanConnectionMock: vi.fn(),
  onDidRegisterContainerConnection: vi.fn(),
  onDidUpdateContainerConnection: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    provider: {
      onDidRegisterContainerConnection: mocks.onDidRegisterContainerConnection,
      onDidUpdateContainerConnection: mocks.onDidUpdateContainerConnection,
    },
    process: {
      exec: vi.fn(),
    },
  };
});

vi.mock('../utils/podman', () => {
  return {
    getPodmanCli: vi.fn(),
    getFirstRunningPodmanConnection: mocks.getFirstRunningPodmanConnectionMock,
  };
});

test('startupSubscribe should execute immediately if provider already registered', async () => {
  const manager = new PodmanConnection();
  // one provider is already registered
  mocks.getFirstRunningPodmanConnectionMock.mockReturnValue({
    connection: {
      type: 'podman',
      status: () => 'started',
    },
  });
  mocks.onDidRegisterContainerConnection.mockReturnValue({
    dispose: vi.fn,
  });
  manager.listenRegistration();
  const handler = vi.fn();
  manager.startupSubscribe(handler);
  // the handler is called immediately
  expect(handler).toHaveBeenCalledOnce();
});

test('startupSubscribe should execute  when provider is registered', async () => {
  const manager = new PodmanConnection();

  // no provider is already registered
  mocks.getFirstRunningPodmanConnectionMock.mockReturnValue(undefined);
  mocks.onDidRegisterContainerConnection.mockImplementation((f: (e: RegisterContainerConnectionEvent) => void) => {
    setTimeout(() => {
      f({
        connection: {
          type: 'podman',
          status: () => 'started',
        },
      } as unknown as RegisterContainerConnectionEvent);
    }, 1);
    return {
      dispose: vi.fn(),
    };
  });
  manager.listenRegistration();
  const handler = vi.fn();
  manager.startupSubscribe(handler);
  // the handler is not called immediately
  expect(handler).not.toHaveBeenCalledOnce();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(handler).toHaveBeenCalledOnce();
});

test('onMachineStart should call the handler when machine starts', async () => {
  const manager = new PodmanConnection();
  mocks.onDidUpdateContainerConnection.mockImplementation((f: (e: UpdateContainerConnectionEvent) => void) => {
    setTimeout(() => {
      f({
        connection: {
          type: 'podman',
        },
        status: 'started',
      } as UpdateContainerConnectionEvent);
    }, 1);
    return {
      dispose: vi.fn(),
    };
  });
  manager.listenMachine();
  const handler = vi.fn();
  manager.onMachineStart(handler);
  expect(handler).not.toHaveBeenCalledOnce();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(handler).toHaveBeenCalledOnce();
});

test('onMachineStop should call the handler when machine stops', async () => {
  const manager = new PodmanConnection();
  mocks.onDidUpdateContainerConnection.mockImplementation((f: (e: UpdateContainerConnectionEvent) => void) => {
    setTimeout(() => {
      f({
        connection: {
          type: 'podman',
        },
        status: 'stopped',
      } as UpdateContainerConnectionEvent);
    }, 1);
    return {
      dispose: vi.fn(),
    };
  });
  manager.listenMachine();
  const handler = vi.fn();
  manager.onMachineStop(handler);
  expect(handler).not.toHaveBeenCalledOnce();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(handler).toHaveBeenCalledOnce();
});

describe('getVMType', () => {
  test('empty response should throw an error', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[]',
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    await expect(() => manager.getVMType('machine')).rejects.toThrowError(
      'podman machine list provided an empty array',
    );
  });

  test('empty array should return UNKNOWN when no name is provided', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[]',
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    expect(await manager.getVMType()).toBe(VMType.UNKNOWN);
  });

  test('malformed response should throw an error', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '{}',
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    await expect(() => manager.getVMType()).rejects.toThrowError('podman machine list provided a malformed response');
  });

  test('array with length greater than one require name', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[{}, {}]',
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    await expect(() => manager.getVMType()).rejects.toThrowError(
      'name need to be provided when more than one podman machine is configured.',
    );
  });

  test('argument name should be used to filter the machine', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          Name: 'machine-1',
          VMType: VMType.QEMU,
        },
        {
          Name: 'machine-2',
          VMType: VMType.APPLEHV,
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    expect(await manager.getVMType('machine-2')).toBe(VMType.APPLEHV);
  });

  test('invalid name should throw an error', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          Name: 'machine-1',
        },
        {
          Name: 'machine-2',
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    await expect(() => manager.getVMType('potatoes')).rejects.toThrowError(
      'cannot find matching podman machine with name potatoes',
    );
  });

  test('single machine should return its VMType', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          Name: 'machine-1',
          VMType: VMType.WSL,
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    expect(await manager.getVMType()).toBe(VMType.WSL);
  });

  test.each(Object.values(VMType) as string[])('%s type should be the expected result', async vmtype => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          VMType: vmtype,
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection();
    expect(await manager.getVMType()).toBe(vmtype);
  });
});
