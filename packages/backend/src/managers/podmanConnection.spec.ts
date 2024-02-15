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

import { expect, test, vi } from 'vitest';
import { PodmanConnection } from './podmanConnection';
import type { RegisterContainerConnectionEvent, UpdateContainerConnectionEvent } from '@podman-desktop/api';

const mocks = vi.hoisted(() => ({
  getContainerConnections: vi.fn(),
  onDidRegisterContainerConnection: vi.fn(),
  onDidUpdateContainerConnection: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    provider: {
      onDidRegisterContainerConnection: mocks.onDidRegisterContainerConnection,
      getContainerConnections: mocks.getContainerConnections,
      onDidUpdateContainerConnection: mocks.onDidUpdateContainerConnection,
    },
  };
});

test('startupSubscribe should execute immediately if provider already registered', () => {
  const manager = new PodmanConnection();
  // one provider is already registered
  mocks.getContainerConnections.mockReturnValue([
    {
      connection: {
        type: 'podman',
        status: () => 'started',
      },
    },
  ]);
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
  mocks.getContainerConnections.mockReturnValue([]);
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
