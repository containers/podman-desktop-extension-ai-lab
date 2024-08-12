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

import { beforeEach, expect, test, describe, vi } from 'vitest';
import * as podmanDesktopApi from '@podman-desktop/api';
import * as utils from '../utils/podman';

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

vi.mock('@podman-desktop/api', () => {
  return {
    env: {
      isWindows: false,
      isLinux: false,
    },
    configuration: {
      getConfiguration: () => config,
    },
    containerEngine: {
      info: vi.fn(),
    },
    navigation: {
      navigateToResources: vi.fn(),
    },
    provider: {
      getContainerConnections: mocks.getContainerConnectionsMock,
    },
    process: {
      exec: vi.fn(),
    },
  };
});

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

describe('getFirstRunningMachineName', () => {
  test('return machine name if connection name does contain default Podman Machine name', () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'Podman Machine',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
    ]);
    const machineName = utils.getFirstRunningMachineName();
    expect(machineName).equals('podman-machine-default');
  });
  test('return machine name if connection name does contain custom Podman Machine name', () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'Podman Machine test',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
    ]);
    const machineName = utils.getFirstRunningMachineName();
    expect(machineName).equals('podman-machine-test');
  });
  test('return machine name if connection name does not contain Podman Machine', () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'test',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
    ]);
    const machineName = utils.getFirstRunningMachineName();
    expect(machineName).equals('test');
  });
  test('return undefined if there is no running connection', () => {
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
    ]);
    const machineName = utils.getFirstRunningMachineName();
    expect(machineName).toBeUndefined();
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
    expect(result?.connection.name).equal('machine2');
  });
});

describe('getPodmanConnection', () => {
  test('throw error if there is no podman connection with name', () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'Podman Machine',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
    ]);
    expect(() => utils.getPodmanConnection('sample')).toThrowError('no podman connection found with name sample');
  });
  test('return connection with specified name', () => {
    mocks.getContainerConnectionsMock.mockReturnValue([
      {
        connection: {
          name: 'Podman Machine',
          status: () => 'started',
          endpoint: {
            socketPath: '/endpoint.sock',
          },
          type: 'podman',
        },
        providerId: 'podman',
      },
    ]);
    const engine = utils.getPodmanConnection('Podman Machine');
    expect(engine).toBeDefined();
    expect(engine.providerId).equals('podman');
    expect(engine.connection.name).equals('Podman Machine');
  });
});
