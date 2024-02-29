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
import * as podmanDesktopApi from '@podman-desktop/api';
import * as utils from '../utils/podman';
import { beforeEach } from 'node:test';

const mocks = vi.hoisted(() => {
  return {
    getConfigurationMock: vi.fn(),
    getContainerConnectionsMock: vi.fn(),
  };
});

const config: podmanDesktopApi.Configuration = {
  get: mocks.getConfigurationMock,
  has: () => true,
  update: () => Promise.resolve(),
};

vi.mock('@podman-desktop/api', () => ({
  env: {
    isWindows: false,
  },
  configuration: {
    getConfiguration: () => config,
  },
  provider: {
    getContainerConnections: mocks.getContainerConnectionsMock,
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getPodmanCli', () => {
  test('should return custom binary path if setting is set', () => {
    mocks.getConfigurationMock.mockReturnValue('binary');
    const result = utils.getPodmanCli();
    expect(result).equals('binary');
  });
  test('should return exe file if on windows', () => {
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    mocks.getConfigurationMock.mockReturnValue(undefined);
    const result = utils.getPodmanCli();
    expect(result).equals('podman.exe');
  });
  test('should return podman file if not on windows', () => {
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.getConfigurationMock.mockReturnValue(undefined);
    const result = utils.getPodmanCli();
    expect(result).equals('podman');
  });
});

describe('getFirstRunningPodmanConnection', () => {
  test('should return undefined if failing at retrieving connection', async () => {
    mocks.getConfigurationMock.mockRejectedValue('error');
    const result = utils.getFirstRunningPodmanConnection();
    expect(result).toBeUndefined();
  });
  test('should return undefined if default podman machine is not running', async () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'machine',
          status: () => 'stopped',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
      {
        connection: {
          name: 'machine2',
          status: () => 'stopped',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman2',
      },
    ]);
    const result = utils.getFirstRunningPodmanConnection();
    expect(result).toBeUndefined();
  });
  test('should return default running podman connection', async () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'machine',
          status: () => 'stopped',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
      {
        connection: {
          name: 'machine2',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman2',
      },
    ]);
    const result = utils.getFirstRunningPodmanConnection();
    expect(result.connection.name).equal('machine2');
  });
});
