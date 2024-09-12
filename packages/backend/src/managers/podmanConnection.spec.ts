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
import { PodmanConnection } from './podmanConnection';
import type {
  ContainerProviderConnection,
  ProviderConnectionStatus,
  ProviderContainerConnection,
  ProviderEvent,
  RegisterContainerConnectionEvent,
  RunResult,
  UnregisterContainerConnectionEvent,
  UpdateContainerConnectionEvent,
  Webview,
} from '@podman-desktop/api';
import { containerEngine, process, provider, EventEmitter, env } from '@podman-desktop/api';
import { VMType } from '@shared/src/models/IPodman';
import { Messages } from '@shared/Messages';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

vi.mock('@podman-desktop/api', async () => {
  return {
    EventEmitter: vi.fn(),
    provider: {
      onDidUnregisterContainerConnection: vi.fn(),
      onDidRegisterContainerConnection: vi.fn(),
      onDidUpdateContainerConnection: vi.fn(),
      onDidUpdateProvider: vi.fn(),
      getContainerConnections: vi.fn(),
    },
    process: {
      exec: vi.fn(),
    },
    containerEngine: {
      listInfos: vi.fn(),
    },
    env: {
      isLinux: vi.fn(),
    },
    navigation: {},
  };
});

vi.mock('../utils/podman', () => {
  return {
    getPodmanCli: vi.fn(),
    MIN_CPUS_VALUE: 4,
  };
});

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(webviewMock.postMessage).mockResolvedValue(true);
  vi.mocked(provider.getContainerConnections).mockReturnValue([]);

  const listeners: ((value: unknown) => void)[] = [];

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);
});

describe('podman connection initialization', () => {
  test('init should notify publisher', () => {
    const manager = new PodmanConnection(webviewMock);
    manager.init();

    expect(webviewMock.postMessage).toHaveBeenCalledWith({
      id: Messages.MSG_PODMAN_CONNECTION_UPDATE,
      body: [],
    });
  });

  test('init should register all provider events', () => {
    const manager = new PodmanConnection(webviewMock);
    manager.init();

    expect(provider.onDidUnregisterContainerConnection).toHaveBeenCalledWith(expect.any(Function));
    expect(provider.onDidRegisterContainerConnection).toHaveBeenCalledWith(expect.any(Function));
    expect(provider.onDidUpdateContainerConnection).toHaveBeenCalledWith(expect.any(Function));
    expect(provider.onDidUpdateProvider).toHaveBeenCalledWith(expect.any(Function));
  });

  test('init should fetch all container connections', () => {
    const statusMock = vi.fn().mockReturnValue('started');
    const providerContainerConnection: ProviderContainerConnection = {
      connection: {
        type: 'podman',
        status: statusMock,
        name: 'Podman Machine',
        endpoint: {
          socketPath: './socket-path',
        },
      },
      providerId: 'podman',
    };
    vi.mocked(provider.getContainerConnections).mockReturnValue([providerContainerConnection]);

    const manager = new PodmanConnection(webviewMock);
    manager.init();

    expect(manager.getContainerProviderConnectionInfo()).toStrictEqual([
      {
        name: 'Podman Machine',
        providerId: 'podman',
        status: 'started',
        type: 'podman',
        vmType: VMType.UNKNOWN,
      },
    ]);

    expect(manager.getContainerProviderConnections()).toStrictEqual([providerContainerConnection.connection]);
    expect(statusMock).toHaveBeenCalled();
  });
});

async function getListeners(): Promise<{
  onDidUnregisterContainerConnection: (e: UnregisterContainerConnectionEvent) => void;
  onDidRegisterContainerConnection: (e: RegisterContainerConnectionEvent) => void;
  onDidUpdateContainerConnection: (e: UpdateContainerConnectionEvent) => void;
  onDidUpdateProvider: (e: ProviderEvent) => void;
  podmanConnection: PodmanConnection;
}> {
  const onDidUnregisterContainerConnectionPromise: Promise<(e: UnregisterContainerConnectionEvent) => void> =
    new Promise(resolve => {
      vi.mocked(provider.onDidUnregisterContainerConnection).mockImplementation(
        (fn: (e: UnregisterContainerConnectionEvent) => void) => {
          resolve(fn);
          return {
            dispose: vi.fn(),
          };
        },
      );
    });

  const onDidRegisterContainerConnectionPromise: Promise<(e: RegisterContainerConnectionEvent) => void> = new Promise(
    resolve => {
      vi.mocked(provider.onDidRegisterContainerConnection).mockImplementation(
        (fn: (e: RegisterContainerConnectionEvent) => void) => {
          resolve(fn);
          return {
            dispose: vi.fn(),
          };
        },
      );
    },
  );

  const onDidUpdateContainerConnectionPromise: Promise<(e: UpdateContainerConnectionEvent) => void> = new Promise(
    resolve => {
      vi.mocked(provider.onDidUpdateContainerConnection).mockImplementation(
        (fn: (e: UpdateContainerConnectionEvent) => void) => {
          resolve(fn);
          return {
            dispose: vi.fn(),
          };
        },
      );
    },
  );

  const onDidUpdateProviderPromise: Promise<(e: ProviderEvent) => void> = new Promise(resolve => {
    vi.mocked(provider.onDidUpdateProvider).mockImplementation((fn: (e: ProviderEvent) => void) => {
      resolve(fn);
      return {
        dispose: vi.fn(),
      };
    });
  });

  const manager = new PodmanConnection(webviewMock);
  manager.init();

  return {
    onDidUnregisterContainerConnection: await onDidUnregisterContainerConnectionPromise,
    onDidRegisterContainerConnection: await onDidRegisterContainerConnectionPromise,
    onDidUpdateContainerConnection: await onDidUpdateContainerConnectionPromise,
    onDidUpdateProvider: await onDidUpdateProviderPromise,
    podmanConnection: manager,
  };
}

describe('container connection event', () => {
  test('onDidUnregisterContainerConnection should refresh and notify webview', async () => {
    const { onDidUnregisterContainerConnection } = await getListeners();

    // simulate onDidUnregisterContainerConnection event
    onDidUnregisterContainerConnection({ providerId: 'podman' });

    // ensure the webview has been notified
    await vi.waitFor(() => {
      expect(webviewMock.postMessage).toHaveBeenCalledWith({
        id: Messages.MSG_PODMAN_CONNECTION_UPDATE,
        body: [],
      });
    });
  });

  test('onDidUnregisterContainerConnection should fire PodmanConnectionEvent', async () => {
    const { onDidUnregisterContainerConnection, podmanConnection } = await getListeners();

    // register event listener
    const onPodmanConnectionEventListenerMock = vi.fn();
    podmanConnection.onPodmanConnectionEvent(onPodmanConnectionEventListenerMock);

    // simulate onDidUnregisterContainerConnection event
    onDidUnregisterContainerConnection({ providerId: 'podman' });

    expect(onPodmanConnectionEventListenerMock).toHaveBeenCalledWith({
      status: 'unregister',
    });
  });

  test('onDidRegisterContainerConnection should notify webview', async () => {
    const { onDidRegisterContainerConnection, podmanConnection } = await getListeners();

    // simulate a onDidRegisterContainerConnection event
    onDidRegisterContainerConnection({
      providerId: 'podman',
      connection: {
        type: 'podman',
        name: 'Podman Machine',
        status: () => 'started',
        endpoint: {
          socketPath: './socket-path',
        },
      },
    });

    // ensure the webview has been notified
    await vi.waitFor(() => {
      expect(webviewMock.postMessage).toHaveBeenCalledWith({
        id: Messages.MSG_PODMAN_CONNECTION_UPDATE,
        body: [
          {
            providerId: 'podman',
            name: 'Podman Machine',
            status: 'started',
            type: 'podman',
            vmType: VMType.UNKNOWN,
          },
        ],
      });
    });

    // ensure it has properly been added
    expect(podmanConnection.getContainerProviderConnectionInfo().length).toBe(1);
  });

  test('onDidRegisterContainerConnection should fire PodmanConnectionEvent', async () => {
    const { onDidRegisterContainerConnection, podmanConnection } = await getListeners();

    // register event listener
    const onPodmanConnectionEventListenerMock = vi.fn();
    podmanConnection.onPodmanConnectionEvent(onPodmanConnectionEventListenerMock);

    // simulate a onDidRegisterContainerConnection event
    onDidRegisterContainerConnection({
      providerId: 'podman',
      connection: {
        type: 'podman',
        name: 'Podman Machine',
        status: () => 'started',
        endpoint: {
          socketPath: './socket-path',
        },
      },
    });

    expect(onPodmanConnectionEventListenerMock).toHaveBeenCalledWith({
      status: 'register',
    });
  });

  test('onDidUpdateProvider should refresh and notify webview', async () => {
    const { onDidUpdateProvider } = await getListeners();

    // simulate onDidUnregisterContainerConnection event
    onDidUpdateProvider({ name: 'podman', status: 'unknown', id: 'podman' });

    // ensure the webview has been notified
    await vi.waitFor(() => {
      expect(webviewMock.postMessage).toHaveBeenCalledWith({
        id: Messages.MSG_PODMAN_CONNECTION_UPDATE,
        body: [],
      });
    });
  });

  test('onDidUpdateContainerConnection should refresh and notify webview', async () => {
    const { onDidUpdateContainerConnection } = await getListeners();

    // simulate onDidUnregisterContainerConnection event
    onDidUpdateContainerConnection({
      status: 'started',
      providerId: 'podman',
      connection: {
        type: 'podman',
        name: 'Podman Machine',
        status: () => 'started',
        endpoint: {
          socketPath: './socket-path',
        },
      },
    });

    // ensure the webview has been notified
    await vi.waitFor(() => {
      expect(webviewMock.postMessage).toHaveBeenCalledWith({
        id: Messages.MSG_PODMAN_CONNECTION_UPDATE,
        body: [],
      });
    });
  });
});

describe('getVMType', () => {
  test('empty response should throw an error', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[]',
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
    await expect(() => manager.getVMType('machine')).rejects.toThrowError(
      'podman machine list provided an empty array',
    );
  });

  test('empty array should return UNKNOWN when no name is provided', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[]',
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
    expect(await manager.getVMType()).toBe(VMType.UNKNOWN);
  });

  test('malformed response should throw an error', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '{}',
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
    await expect(() => manager.getVMType()).rejects.toThrowError('podman machine list provided a malformed response');
  });

  test('array with length greater than one require name', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: '[{}, {}]',
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
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

    const manager = new PodmanConnection(webviewMock);
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

    const manager = new PodmanConnection(webviewMock);
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

    const manager = new PodmanConnection(webviewMock);
    expect(await manager.getVMType()).toBe(VMType.WSL);
  });

  test('unknown string should return UNKNOWN', async () => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          Name: 'machine-1',
          VMType: 'fake-content',
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
    expect(await manager.getVMType()).toBe(VMType.UNKNOWN);
  });

  test.each(Object.values(VMType) as string[])('%s type should be the expected result', async vmtype => {
    vi.mocked(process.exec).mockResolvedValue({
      stdout: JSON.stringify([
        {
          VMType: vmtype,
        },
      ]),
    } as unknown as RunResult);

    const manager = new PodmanConnection(webviewMock);
    expect(await manager.getVMType()).toBe(vmtype);
  });
});

const modelMock: ModelInfo & { memory: number } = {
  name: 'dummy',
  memory: 10,
  description: '',
  id: 'dummy-id',
  properties: {},
};

describe('checkContainerConnectionStatusAndResources', () => {
  test('return native on Linux', async () => {
    const manager = new PodmanConnection(webviewMock);
    vi.mocked(env).isLinux = true;

    const result = await manager.checkContainerConnectionStatusAndResources({
      model: modelMock,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'native',
      canRedirect: expect.any(Boolean),
    });
  });

  test('return noMachineInfo if there is no running podman connection', async () => {
    const manager = new PodmanConnection(webviewMock);
    vi.mocked(env).isLinux = false;

    const result = await manager.checkContainerConnectionStatusAndResources({
      model: modelMock,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'no-machine',
      canRedirect: expect.any(Boolean),
    });
  });

  test('return noMachineInfo if we are not able to retrieve any info about the podman connection', async () => {
    const manager = new PodmanConnection(webviewMock);
    vi.mocked(env).isLinux = false;

    vi.mocked(containerEngine.listInfos).mockResolvedValue([]);
    const result = await manager.checkContainerConnectionStatusAndResources({
      model: modelMock,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'no-machine',
      canRedirect: expect.any(Boolean),
    });
  });

  test('return lowResourceMachineInfo if the podman connection has not enough cpus', async () => {
    const manager = new PodmanConnection(webviewMock);
    vi.mocked(env).isLinux = false;

    vi.mocked(provider.getContainerConnections).mockReturnValue([
      {
        connection: {
          type: 'podman',
          status: (): ProviderConnectionStatus => 'started',
          name: 'Podman Machine',
          endpoint: {
            socketPath: './socket-path',
          },
        },
        providerId: 'podman',
      },
    ]);

    vi.mocked(containerEngine.listInfos).mockResolvedValue([
      {
        engineId: 'engineId',
        engineName: 'enginerName',
        engineType: 'podman',
        cpus: 3,
        memory: 20,
        memoryUsed: 0,
      },
    ]);

    manager.init();

    const result = await manager.checkContainerConnectionStatusAndResources({
      model: modelMock,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      status: 'low-resources',
      canRedirect: expect.any(Boolean),
      name: 'Podman Machine',
      canEdit: false,
      cpus: 3,
      memoryIdle: 20,
      cpusExpected: 4,
      memoryExpected: 11,
    });
  });

  test('return runningMachineInfo if the podman connection has enough resources', async () => {
    const manager = new PodmanConnection(webviewMock);
    vi.mocked(env).isLinux = false;

    vi.mocked(provider.getContainerConnections).mockReturnValue([
      {
        connection: {
          type: 'podman',
          status: (): ProviderConnectionStatus => 'started',
          name: 'Podman Machine',
          endpoint: {
            socketPath: './socket-path',
          },
        },
        providerId: 'podman',
      },
    ]);

    vi.mocked(containerEngine.listInfos).mockResolvedValue([
      {
        engineId: 'engineId',
        engineName: 'enginerName',
        engineType: 'podman',
        cpus: 12,
        memory: 20,
        memoryUsed: 0,
      },
    ]);

    manager.init();

    const result = await manager.checkContainerConnectionStatusAndResources({
      model: modelMock,
      context: 'inference',
    });
    expect(result).toStrictEqual({
      name: 'Podman Machine',
      status: 'running',
      canRedirect: expect.any(Boolean),
    });
  });
});

describe('getConnectionByEngineId', () => {
  test('no provider should raise an error', async () => {
    vi.mocked(provider.getContainerConnections).mockReturnValue([]);

    const manager = new PodmanConnection(webviewMock);
    manager.init();

    await expect(() => manager.getConnectionByEngineId('fake engine')).rejects.toThrowError('connection not found');

    expect(containerEngine.listInfos).not.toHaveBeenCalled();
  });

  test('empty listInfos response should raise an error', async () => {
    vi.mocked(provider.getContainerConnections).mockReturnValue([
      {
        connection: {
          type: 'podman',
          status: (): ProviderConnectionStatus => 'started',
          name: 'Podman Machine',
          endpoint: {
            socketPath: './socket-path',
          },
        },
        providerId: 'podman',
      },
    ]);

    vi.mocked(containerEngine.listInfos).mockResolvedValue([]);

    const manager = new PodmanConnection(webviewMock);
    manager.init();

    await expect(() => manager.getConnectionByEngineId('fake engine')).rejects.toThrowError('connection not found');

    expect(containerEngine.listInfos).toHaveBeenCalled();
  });

  test('invalid engineId should raise an error', async () => {
    vi.mocked(provider.getContainerConnections).mockReturnValue([
      {
        connection: {
          type: 'podman',
          status: (): ProviderConnectionStatus => 'started',
          name: 'Podman Machine',
          endpoint: {
            socketPath: './socket-path',
          },
        },
        providerId: 'podman',
      },
    ]);

    vi.mocked(containerEngine.listInfos).mockResolvedValue([
      {
        engineId: 'engineId',
        engineName: 'enginerName',
        engineType: 'podman',
        cpus: 12,
        memory: 20,
        memoryUsed: 0,
      },
    ]);

    const manager = new PodmanConnection(webviewMock);
    manager.init();

    await expect(() => manager.getConnectionByEngineId('fake engine')).rejects.toThrowError('connection not found');

    expect(containerEngine.listInfos).toHaveBeenCalled();
  });

  test('valid engineId should return matching connection', async () => {
    const connectionMock: ContainerProviderConnection = {
      type: 'podman',
      status: () => 'started',
      name: 'Podman Machine',
      endpoint: {
        socketPath: './socket-path',
      },
    };
    vi.mocked(provider.getContainerConnections).mockReturnValue([
      {
        connection: connectionMock,
        providerId: 'podman',
      },
    ]);

    vi.mocked(containerEngine.listInfos).mockResolvedValue([
      {
        engineId: 'engineId',
        engineName: 'enginerName',
        engineType: 'podman',
        cpus: 12,
        memory: 20,
        memoryUsed: 0,
      },
    ]);

    const manager = new PodmanConnection(webviewMock);
    manager.init();

    const connection = await manager.getConnectionByEngineId('engineId');

    expect(containerEngine.listInfos).toHaveBeenCalled();
    expect(connection).toBe(connectionMock);
  });
});
