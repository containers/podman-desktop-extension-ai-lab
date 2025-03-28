/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { getImageInfo, LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { ContainerProviderConnection, ImageInfo } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { VMType } from '@shared/models/IPodman';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import type { InferenceServer } from '@shared/models/IInference';
import { InferenceType } from '@shared/models/IInference';
import { openvino } from '../../assets/inference-images.json';
import type { ContainerProviderConnectionInfo } from '@shared/models/IContainerConnectionInfo';
import { join } from 'node:path';
import { OpenVINO, SECOND } from './OpenVINO';
import type { ModelsManager } from '../../managers/modelsManager';

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    createContainer: vi.fn(),
  },
}));

vi.mock('../../utils/inferenceUtils', () => ({
  getProviderContainerConnection: vi.fn(),
  getImageInfo: vi.fn(),
  LABEL_INFERENCE_SERVER: 'ai-lab-inference-server',
}));

const taskRegistry: TaskRegistry = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
} as unknown as TaskRegistry;

const DummyModel: ModelInfo = {
  name: 'dummy model',
  id: 'dummy-model-id',
  file: {
    file: 'dummy-file.guff',
    path: 'dummy-path',
  },
  properties: {},
  description: 'dummy-desc',
};

const dummyConnection: ContainerProviderConnection = {
  name: 'dummy-provider-connection',
  type: 'podman',
  vmType: VMType.WSL,
  status: () => 'started',
  endpoint: {
    socketPath: 'dummy-socket',
  },
};

const DummyImageInfo: ImageInfo = {
  Id: 'dummy-image-id',
  engineId: 'dummy-engine-id',
} as unknown as ImageInfo;

const podmanConnection: PodmanConnection = {
  findRunningContainerProviderConnection: vi.fn(),
  getContainerProviderConnection: vi.fn(),
} as unknown as PodmanConnection;

const configurationRegistry: ConfigurationRegistry = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

const modelsManager: ModelsManager = {
  getModelInfo: vi.fn(),
} as unknown as ModelsManager;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    experimentalGPU: false,
    modelsPath: 'model-path',
    apiPort: 10434,
    experimentalTuning: false,
    modelUploadDisabled: false,
    showGPUPromotion: false,
    appearance: 'dark',
  });
  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue(dummyConnection);
  vi.mocked(podmanConnection.getContainerProviderConnection).mockReturnValue(dummyConnection);
  vi.mocked(getImageInfo).mockResolvedValue(DummyImageInfo);
  vi.mocked(taskRegistry.createTask).mockReturnValue({ id: 'dummy-task-id', name: '', labels: {}, state: 'loading' });
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummy-container-id',
    engineId: 'dummy-engine-id',
  });
});

test('OpenVINO being the default, it should always be enable', () => {
  const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);
  expect(provider.enabled()).toBeTruthy();
});

describe('perform', () => {
  test('config without image should use defined image', async () => {
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(podmanConnection.findRunningContainerProviderConnection).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(dummyConnection, openvino.default, expect.anything());
  });

  test('config without models should throw an error', async () => {
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    await expect(
      provider.perform({
        port: 8000,
        image: undefined,
        labels: {},
        modelsInfo: [],
        connection: undefined,
      }),
    ).rejects.toThrowError('Need at least one model info to start an inference server.');
  });

  test('config model without file should throw an error', async () => {
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    await expect(
      provider.perform({
        port: 8000,
        image: undefined,
        labels: {},
        modelsInfo: [
          {
            id: 'invalid',
          } as unknown as ModelInfo,
        ],
        connection: undefined,
      }),
    ).rejects.toThrowError('The model info file provided is undefined');
  });

  test('valid config should produce expected CreateContainerOptions', async () => {
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    vi.mocked(modelsManager.getModelInfo).mockReturnValue(DummyModel);

    const server = await provider.perform({
      port: 8888,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(server).toStrictEqual<InferenceServer>({
      container: {
        containerId: 'dummy-container-id',
        engineId: DummyImageInfo.engineId,
      },
      labels: {
        [LABEL_INFERENCE_SERVER]: `["${DummyModel.id}"]`,
        api: 'http://localhost:8888/v3',
        docs: 'http://localhost:10434/api-docs/8888',
      },
      models: [DummyModel],
      status: 'running',
      type: InferenceType.OPENVINO,
      connection: {
        port: 8888,
      },
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(DummyImageInfo.engineId, {
      Cmd: ['--rest_port', '8000', '--config_path', '/model/config-all.json', '--metrics_enable'],
      Detach: true,
      Entrypoint: undefined,
      Env: ['MODEL_PATH=/model', 'HOST=0.0.0.0', 'PORT=8000'],
      ExposedPorts: {
        '8888': {},
      },
      HealthCheck: {
        Interval: SECOND * 5,
        Retries: 20,
        Test: ['CMD-SHELL', 'curl -sSf localhost:8000/metrics > /dev/null'],
      },
      HostConfig: {
        AutoRemove: false,
        Mounts: [
          {
            Source: join('dummy-path', 'dummy-file.guff'),
            Target: '/model',
            Type: 'bind',
          },
        ],
        DeviceRequests: [],
        Devices: [],
        PortBindings: {
          '8000/tcp': [
            {
              HostPort: '8888',
            },
          ],
        },
        SecurityOpt: ['label=disable'],
      },
      Image: DummyImageInfo.Id,
      Labels: {
        [LABEL_INFERENCE_SERVER]: `["${DummyModel.id}"]`,
        api: 'http://localhost:8888/v3',
        docs: 'http://localhost:10434/api-docs/8888',
      },
    });
  });

  test('model properties should be made uppercased', async () => {
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [
        {
          ...DummyModel,
          properties: {
            basicProp: 'basicProp',
            lotOfCamelCases: 'lotOfCamelCases',
            lowercase: 'lowercase',
            chatFormat: 'dummyChatFormat',
          },
        },
      ],
      connection: undefined,
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(DummyImageInfo.engineId, {
      Env: expect.arrayContaining([
        'MODEL_BASIC_PROP=basicProp',
        'MODEL_LOT_OF_CAMEL_CASES=lotOfCamelCases',
        'MODEL_LOWERCASE=lowercase',
        'MODEL_CHAT_FORMAT=dummyChatFormat',
      ]),
      Cmd: expect.anything(),
      HealthCheck: expect.anything(),
      HostConfig: expect.anything(),
      ExposedPorts: expect.anything(),
      Labels: expect.anything(),
      Image: DummyImageInfo.Id,
      Detach: true,
    });
  });

  test('provided connection should be used for pulling the image', async () => {
    const connection: ContainerProviderConnectionInfo = {
      name: 'Dummy Podman',
      type: 'podman',
      vmType: VMType.WSL,
      status: 'started',
      providerId: 'fakeProviderId',
    };
    const provider = new OpenVINO(taskRegistry, podmanConnection, modelsManager, configurationRegistry);

    await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: connection,
    });

    expect(podmanConnection.getContainerProviderConnection).toHaveBeenCalledWith(connection);
    expect(podmanConnection.findRunningContainerProviderConnection).not.toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(dummyConnection, openvino.default, expect.anything());
  });
});
