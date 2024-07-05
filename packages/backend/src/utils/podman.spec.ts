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

import { beforeEach, expect, test, describe, vi, afterEach } from 'vitest';
import * as podmanDesktopApi from '@podman-desktop/api';
import * as utils from '../utils/podman';
import type { ContainerEngineInfo } from '@podman-desktop/api';

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

describe('checkContainerConnectionStatusAndResources', () => {
  const engineInfo: podmanDesktopApi.ContainerEngineInfo = {
    engineId: 'engineId',
    engineName: 'enginerName',
    engineType: 'podman',
  };
  afterEach(() => {
    vi.mocked(podmanDesktopApi.env).isLinux = false;
  });
  test('return native on Linux', async () => {
    vi.mocked(podmanDesktopApi.env).isLinux = true;
    vi.spyOn(utils, 'getFirstRunningPodmanConnection').mockReturnValue(undefined);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'native',
      canRedirect: true,
    });
  });
  test('return noMachineInfo if there is no running podman connection', async () => {
    vi.spyOn(utils, 'getFirstRunningPodmanConnection').mockReturnValue(undefined);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'no-machine',
      canRedirect: true,
    });
  });
  test('return noMachineInfo if we are not able to retrieve any info about the podman connection', async () => {
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
    vi.mocked(podmanDesktopApi.containerEngine.info).mockResolvedValue(undefined as unknown as ContainerEngineInfo);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'no-machine',
      canRedirect: true,
    });
  });
  test('return lowResourceMachineInfo if the podman connection has not enough cpus', async () => {
    engineInfo.cpus = 3;
    engineInfo.memory = 20;
    engineInfo.memoryUsed = 0;
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
    vi.mocked(podmanDesktopApi.containerEngine.info).mockResolvedValue(engineInfo);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      name: 'Podman Machine',
      cpus: 3,
      memoryIdle: 20,
      cpusExpected: 4,
      memoryExpected: 11,
      status: 'low-resources',
      canEdit: false,
      canRedirect: true,
    });
  });
  test('return lowResourceMachineInfo if the podman connection has not enough memory', async () => {
    engineInfo.cpus = 12;
    engineInfo.memory = 20;
    engineInfo.memoryUsed = 15;
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
    vi.mocked(podmanDesktopApi.containerEngine.info).mockResolvedValue(engineInfo);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      name: 'Podman Machine',
      cpus: 12,
      memoryIdle: 5,
      cpusExpected: 4,
      memoryExpected: 11,
      status: 'low-resources',
      canEdit: false,
      canRedirect: true,
    });
  });
  test('return runningMachineInfo if the podman connection has enough resources', async () => {
    engineInfo.cpus = 12;
    engineInfo.memory = 20;
    engineInfo.memoryUsed = 0;
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
    vi.spyOn(podmanDesktopApi.containerEngine, 'info').mockResolvedValue(engineInfo);
    const result = await utils.checkContainerConnectionStatusAndResources({
      memoryNeeded: 10,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      name: 'Podman Machine',
      status: 'running',
      canRedirect: true,
    });
  });
});
