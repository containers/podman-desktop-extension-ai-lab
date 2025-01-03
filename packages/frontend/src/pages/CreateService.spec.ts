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

import '@testing-library/jest-dom/vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import { studioClient } from '/@/utils/client';
import { fireEvent, render, screen } from '@testing-library/svelte';
import CreateService from '/@/pages/CreateService.svelte';
import type { Task } from '@shared/src/models/ITask';
import userEvent from '@testing-library/user-event';
import type { InferenceServer } from '@shared/src/models/IInference';
import * as modelsInfoStore from '/@/stores/modelsInfo';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { writable } from 'svelte/store';
import { router } from 'tinro';
import type {
  ContainerConnectionInfo,
  ContainerProviderConnectionInfo,
} from '@shared/src/models/IContainerConnectionInfo';
import * as path from 'node:path';
import * as os from 'node:os';
import { VMType } from '@shared/src/models/IPodman';

const mocks = vi.hoisted(() => {
  return {
    // models store
    modelsInfoSubscribeMock: vi.fn(),
    modelsInfoQueriesMock: {
      subscribe: (f: (msg: unknown) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return (): void => {};
      },
    },
    // server store
    getInferenceServersMock: vi.fn(),
    // tasks store
    tasksSubscribeMock: vi.fn(),
    tasksQueriesMock: {
      subscribe: (f: (msg: unknown) => void) => {
        f(mocks.tasksSubscribeMock());
        return (): void => {};
      },
    },
    getContainerConnectionInfoMock: vi.fn<() => ContainerProviderConnectionInfo[]>(),
  };
});

vi.mock('../stores/inferenceServers', () => ({
  inferenceServers: {
    subscribe: (f: (msg: unknown) => void) => {
      f(mocks.getInferenceServersMock());
      return (): void => {};
    },
  },
}));

vi.mock('../stores/containerProviderConnections', () => ({
  containerProviderConnections: {
    subscribe: (f: (msg: unknown) => void) => {
      f(mocks.getContainerConnectionInfoMock());
      return (): void => {};
    },
  },
}));

vi.mock('../stores/modelsInfo', async () => {
  return {
    modelsInfo: mocks.modelsInfoQueriesMock,
  };
});

vi.mock('../stores/tasks', async () => {
  return {
    tasks: mocks.tasksQueriesMock,
  };
});

vi.mock('../utils/client', async () => ({
  studioClient: {
    requestCreateInferenceServer: vi.fn(),
    getHostFreePort: vi.fn(),
    checkContainerConnectionStatusAndResources: vi.fn(),
    getExtensionConfiguration: vi.fn(),
  },
  rpcBrowser: {
    subscribe: (): unknown => {
      return {
        unsubscribe: (): void => {},
      };
    },
  },
}));

const noMachineConnectionInfo: ContainerConnectionInfo = {
  status: 'no-machine',
  canRedirect: true,
};

const runningMachineConnectionInfo: ContainerConnectionInfo = {
  name: 'Podman machine',
  status: 'running',
  canRedirect: true,
};

const lowResourceMachineConnectionInfo: ContainerConnectionInfo = {
  name: 'Podman Machine',
  canEdit: true,
  canRedirect: true,
  cpus: 12,
  cpusExpected: 10,
  memoryExpected: 10,
  memoryIdle: 5,
  status: 'low-resources',
};

const containerProviderConnection: ContainerProviderConnectionInfo = {
  name: 'Dummy connainter connection provider',
  status: 'started',
  type: 'podman',
  vmType: VMType.QEMU,
  providerId: 'podman',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
  mocks.tasksSubscribeMock.mockReturnValue([]);
  mocks.getContainerConnectionInfoMock.mockReturnValue([containerProviderConnection]);

  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue(runningMachineConnectionInfo);
  vi.mocked(studioClient.requestCreateInferenceServer).mockResolvedValue('dummyTrackingId');
  vi.mocked(studioClient.getHostFreePort).mockResolvedValue(8888);
  mocks.getInferenceServersMock.mockReturnValue([
    { container: { containerId: 'dummyContainerId' } } as InferenceServer,
  ]);
  vi.mocked(studioClient.getExtensionConfiguration).mockResolvedValue({
    experimentalGPU: false,
    apiPort: 0,
    experimentalTuning: false,
    modelsPath: '',
    modelUploadDisabled: false,
    showGPUPromotion: false,
  });

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

test('create button should be disabled when no model id provided', async () => {
  render(CreateService);

  await vi.waitFor(() => {
    const createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
    expect(createBtn.attributes.getNamedItem('disabled')).toBeTruthy();
  });
});

test('expect error message to be displayed when no model locally', async () => {
  render(CreateService);

  await vi.waitFor(() => {
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });
});

test('expect error message to be hidden when models locally', () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);
  render(CreateService);

  const alert = screen.queryByRole('alert');
  expect(alert).toBeNull();
});

test('button click should call createInferenceServer', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);

  render(CreateService);

  let createBtn: HTMLElement | undefined = undefined;
  await vi.waitFor(() => {
    createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
    expect(createBtn).toBeEnabled();
  });

  if (createBtn === undefined) throw new Error('createBtn undefined');

  await fireEvent.click(createBtn);
  expect(vi.mocked(studioClient.requestCreateInferenceServer)).toHaveBeenCalledWith({
    modelsInfo: [{ id: 'random', file: true }],
    port: 8888,
    connection: containerProviderConnection,
  });
});

test('create button should be disabled if no container engine running', async () => {
  // mock no container connection available
  mocks.getContainerConnectionInfoMock.mockReturnValue([]);
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);

  const { getByTitle, getByRole } = render(CreateService);

  const createBtn: HTMLElement = await vi.waitFor(() => {
    const element = getByTitle('Create service');
    expect(element).toBeDefined();
    return element;
  });
  expect(createBtn).toBeDisabled();

  const alert = getByRole('alert');
  expect(alert).toHaveTextContent('No running container engine found');
});

test('tasks progress should not be visible by default', async () => {
  render(CreateService);

  const status = screen.queryByRole('status');
  expect(status).toBeNull();
});

test('tasks should be displayed after requestCreateInferenceServer', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);

  let listener: ((tasks: Task[]) => void) | undefined;
  vi.spyOn(mocks.tasksQueriesMock, 'subscribe').mockImplementation((f: (tasks: Task[]) => void) => {
    listener = f;
    listener([]);
    return (): void => {};
  });

  render(CreateService, {
    trackingId: 'dummyTrackingId',
  });

  // wait for listener to be defined
  await vi.waitFor(() => {
    expect(listener).toBeDefined();
  });

  let createBtn: HTMLElement | undefined = undefined;
  await vi.waitFor(() => {
    createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
  });

  if (createBtn === undefined || listener === undefined) throw new Error('properties undefined');

  await fireEvent.click(createBtn);

  await vi.waitFor(() => {
    expect(studioClient.requestCreateInferenceServer).toHaveBeenCalled();
  });

  listener([
    {
      id: 'dummyTaskId',
      labels: {
        trackingId: 'dummyTrackingId',
      },
      name: 'Dummy Task name',
      state: 'loading',
    },
  ]);

  await vi.waitFor(() => {
    const status = screen.getByRole('status');
    expect(status).toBeDefined();
  });
});

test('port input should update on user input', async () => {
  render(CreateService);

  const portInput: HTMLInputElement = screen.getByRole('textbox', { name: 'Port input' });
  expect(portInput).toBeDefined();

  await fireEvent.input(portInput, '8888');

  await vi.waitFor(() => {
    expect(portInput.value).toBe('8888');
  });
});

test('form should be disabled when loading', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);

  let listener: ((tasks: Task[]) => void) | undefined;
  vi.spyOn(mocks.tasksQueriesMock, 'subscribe').mockImplementation((f: (tasks: Task[]) => void) => {
    listener = f;
    listener([]);
    return (): void => {};
  });

  render(CreateService, {
    trackingId: 'dummyTrackingId',
  });

  // wait for listener to be defined
  await vi.waitFor(() => {
    expect(listener).toBeDefined();
  });

  let createBtn: HTMLElement | undefined = undefined;
  await vi.waitFor(() => {
    createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
  });

  if (createBtn === undefined || listener === undefined) throw new Error('properties undefined');

  await fireEvent.click(createBtn);

  await vi.waitFor(() => {
    expect(studioClient.requestCreateInferenceServer).toHaveBeenCalled();
  });

  listener([
    {
      id: 'dummyTaskId',
      labels: {
        trackingId: 'dummyTrackingId',
      },
      name: 'Dummy Task name',
      state: 'loading',
    },
  ]);

  await vi.waitFor(() => {
    const input = screen.getByRole('textbox', { name: 'Port input' });
    expect(input).toBeDisabled();
  });
});

test('should display error message if createService fails', async () => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([{ id: 'random', file: true }]);

  let listener: ((tasks: Task[]) => void) | undefined;
  vi.spyOn(mocks.tasksQueriesMock, 'subscribe').mockImplementation((f: (tasks: Task[]) => void) => {
    listener = f;
    listener([]);
    return (): void => {};
  });

  vi.mocked(studioClient.requestCreateInferenceServer).mockRejectedValue('error creating service');
  render(CreateService);

  let createBtn: HTMLElement | undefined = undefined;
  await vi.waitFor(() => {
    createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
  });

  if (createBtn === undefined) throw new Error('createBtn undefined');

  const errorMessage = screen.queryByLabelText('Error Message Content');
  expect(errorMessage).not.toBeInTheDocument();

  await userEvent.click(createBtn);

  const errorMessageAfterSubmit = screen.getByLabelText('Error Message Content');
  expect(errorMessageAfterSubmit).toBeInTheDocument();
  expect(errorMessageAfterSubmit?.textContent).equal('error creating service');
});

test('should display connectionInfo message if there is no running connection', async () => {
  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue(noMachineConnectionInfo);
  const modelsInfoList = writable<ModelInfo[]>([
    {
      id: 'id',
      file: {
        file: 'file',
        path: path.resolve(os.tmpdir(), 'path'),
      },
      memory: 10,
    } as unknown as ModelInfo,
  ]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;
  render(CreateService);

  await vi.waitFor(() => {
    const banner = screen.getByLabelText('Container connection info banner');
    expect(banner).toBeInTheDocument();
  });
});

test('should display connectionInfo message if there is a podman connection with low resources', async () => {
  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue(
    lowResourceMachineConnectionInfo,
  );
  const modelsInfoList = writable<ModelInfo[]>([
    {
      id: 'id',
      file: {
        file: 'file',
        path: path.resolve(os.tmpdir(), 'path'),
      },
      memory: 10,
    } as unknown as ModelInfo,
  ]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;
  render(CreateService);

  await vi.waitFor(() => {
    const banner = screen.getByLabelText('Container connection info banner');
    expect(banner).toBeInTheDocument();
  });
});

test('there should be NO banner if there is a running podman connection having enough resources', async () => {
  const modelsInfoList = writable<ModelInfo[]>([
    {
      id: 'id',
      file: {
        file: 'file',
        path: path.resolve(os.tmpdir(), 'path'),
      },
      memory: 10,
    } as unknown as ModelInfo,
  ]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;
  render(CreateService);

  await vi.waitFor(() => {
    const banner = screen.queryByLabelText('Container connection info banner');
    expect(banner).not.toBeInTheDocument();
  });
});

test('model-id query should be used to select default model', async () => {
  const modelsInfoList = writable<ModelInfo[]>([
    {
      id: 'model-id-1',
      file: {
        file: 'file',
        path: '/path',
      },
    } as unknown as ModelInfo,
    {
      id: 'model-id-2',
      file: {
        file: 'file',
        path: '/path',
      },
    } as unknown as ModelInfo,
  ]);
  vi.mocked(modelsInfoStore).modelsInfo = modelsInfoList;
  router.location.query.set('model-id', 'model-id-2');

  render(CreateService);
  const createBtn = screen.getByTitle('Create service');

  await vi.waitFor(() => {
    expect(createBtn).toBeEnabled();
  });

  await fireEvent.click(createBtn);

  await vi.waitFor(() => {
    expect(studioClient.requestCreateInferenceServer).toHaveBeenCalledWith({
      modelsInfo: [expect.objectContaining({ id: 'model-id-2' })],
      port: 8888,
      connection: containerProviderConnection,
    });
  });
});
