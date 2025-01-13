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

import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { readable, writable } from 'svelte/store';
import { router } from 'tinro';
import type {
  ContainerConnectionInfo,
  ContainerProviderConnectionInfo,
} from '@shared/src/models/IContainerConnectionInfo';
import * as path from 'node:path';
import * as os from 'node:os';
import { VMType } from '@shared/src/models/IPodman';
// stores
import * as ConnectionStore from '/@/stores/containerProviderConnections';
import * as InferenceStore from '/@/stores/inferenceServers';
import * as ModelsInfoStore from '/@/stores/modelsInfo';
import * as TaskStore from '/@/stores/tasks';

vi.mock('/@/stores/containerProviderConnections');
vi.mock('/@/stores/inferenceServers');
vi.mock('/@/stores/modelsInfo');
vi.mock('/@/stores/tasks');
vi.mock('../utils/client', () => ({
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

const DUMMY_DOWNLOADED_MODEL: ModelInfo = {
  id: 'dummy-model-id',
  file: {
    file: 'fake-file',
    path: 'fake-path',
  },
  name: 'dummy-name',
  description: 'fake description',
  properties: {},
  memory: 10,
};

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

  vi.mocked(InferenceStore).inferenceServers = readable([
    { container: { containerId: 'dummyContainerId' } } as InferenceServer,
  ]);
  vi.mocked(ModelsInfoStore).modelsInfo = readable([DUMMY_DOWNLOADED_MODEL]);
  vi.mocked(TaskStore).tasks = readable([]);
  vi.mocked(ConnectionStore).containerProviderConnections = readable([containerProviderConnection]);

  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue(runningMachineConnectionInfo);
  vi.mocked(studioClient.requestCreateInferenceServer).mockResolvedValue('dummyTrackingId');
  vi.mocked(studioClient.getHostFreePort).mockResolvedValue(8888);
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
  vi.mocked(ModelsInfoStore).modelsInfo = readable([]);
  render(CreateService);

  await vi.waitFor(() => {
    const createBtn = screen.getByTitle('Create service');
    expect(createBtn).toBeDefined();
    expect(createBtn.attributes.getNamedItem('disabled')).toBeTruthy();
  });
});

test('expect error message to be displayed when no model locally', async () => {
  // mock an empty store to simulate no models
  vi.mocked(ModelsInfoStore).modelsInfo = readable([]);
  render(CreateService);

  await vi.waitFor(() => {
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });
});

test('expect error message to be hidden when models locally', () => {
  render(CreateService);

  const alert = screen.queryByRole('alert');
  expect(alert).toBeNull();
});

test('button click should call createInferenceServer', async () => {
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
    modelsInfo: [DUMMY_DOWNLOADED_MODEL],
    port: 8888,
    connection: containerProviderConnection,
  });
});

test('containerProviderConnections should remove no running container errro', async () => {
  // mock an empty store
  vi.mocked(ConnectionStore).containerProviderConnections = readable([]);

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
  const store = writable<Task[]>([]);
  vi.mocked(TaskStore).tasks = store;

  render(CreateService, {
    trackingId: 'dummyTrackingId',
  });

  const createBtn: HTMLElement = await vi.waitFor(() => {
    const element = screen.getByTitle('Create service');
    expect(element).toBeDefined();
    return element;
  });

  await fireEvent.click(createBtn);

  await vi.waitFor(() => {
    expect(studioClient.requestCreateInferenceServer).toHaveBeenCalled();
  });

  store.set([
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
  const store = writable<Task[]>([]);
  vi.mocked(TaskStore).tasks = store;

  render(CreateService, {
    trackingId: 'dummyTrackingId',
  });

  const createBtn: HTMLElement = await vi.waitFor(() => {
    const element = screen.getByTitle('Create service');
    expect(element).toBeDefined();
    return element;
  });

  await fireEvent.click(createBtn);

  await vi.waitFor(() => {
    expect(studioClient.requestCreateInferenceServer).toHaveBeenCalled();
  });

  store.set([
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
  vi.mocked(studioClient.requestCreateInferenceServer).mockRejectedValue('error creating service');
  render(CreateService);

  const createBtn: HTMLElement = await vi.waitFor(() => {
    const element = screen.getByTitle('Create service');
    expect(element).toBeDefined();
    return element;
  });

  const errorMessage = screen.queryByLabelText('Error Message Content');
  expect(errorMessage).not.toBeInTheDocument();

  await userEvent.click(createBtn);

  const errorMessageAfterSubmit = screen.getByLabelText('Error Message Content');
  expect(errorMessageAfterSubmit).toBeInTheDocument();
  expect(errorMessageAfterSubmit?.textContent).equal('error creating service');
});

test('should display connectionInfo message if there is no running connection', async () => {
  vi.mocked(studioClient.checkContainerConnectionStatusAndResources).mockResolvedValue(noMachineConnectionInfo);
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
  vi.mocked(ModelsInfoStore).modelsInfo = modelsInfoList;
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
  vi.mocked(ModelsInfoStore).modelsInfo = modelsInfoList;
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
  vi.mocked(ModelsInfoStore).modelsInfo = modelsInfoList;
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
