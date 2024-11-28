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
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { LlamaCppPython, SECOND } from './LlamaCppPython';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getImageInfo, LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { ContainerProviderConnection, ImageInfo } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { GPUManager } from '../../managers/GPUManager';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { VMType } from '@shared/src/models/IPodman';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { GPUVendor } from '@shared/src/models/IGPUInfo';
import type { InferenceServer } from '@shared/src/models/IInference';
import { InferenceType } from '@shared/src/models/IInference';
import { llamacpp } from '../../assets/inference-images.json';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';

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

const gpuManager: GPUManager = {
  collectGPUs: vi.fn(),
} as unknown as GPUManager;

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

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    experimentalGPU: false,
    modelsPath: 'model-path',
    apiPort: 10434,
    experimentalTuning: false,
    modelUploadDisabled: false,
    showGPUPromotion: false,
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

test('LlamaCppPython being the default, it should always be enable', () => {
  const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
  expect(provider.enabled()).toBeTruthy();
});

describe('perform', () => {
  test('config without image should use defined image', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

    await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(podmanConnection.findRunningContainerProviderConnection).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(dummyConnection, llamacpp.default, expect.anything());
  });

  test('config without models should throw an error', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

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
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

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
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

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
        api: 'http://localhost:8888/v1',
        docs: 'http://localhost:8888/docs',
      },
      models: [DummyModel],
      status: 'running',
      type: InferenceType.LLAMA_CPP,
      connection: {
        port: 8888,
      },
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(DummyImageInfo.engineId, {
      Cmd: [],
      Detach: true,
      Env: ['MODEL_PATH=/models/dummy-file.guff', 'HOST=0.0.0.0', 'PORT=8000'],
      ExposedPorts: {
        '8888': {},
      },
      HealthCheck: {
        Interval: SECOND * 5,
        Retries: 20,
        Test: ['CMD-SHELL', 'curl -sSf localhost:8000/docs > /dev/null'],
      },
      HostConfig: {
        AutoRemove: false,
        Mounts: [
          {
            Source: 'dummy-path',
            Target: '/models',
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
        api: 'http://localhost:8888/v1',
        docs: 'http://localhost:8888/docs',
      },
    });
  });

  test('model properties should be made uppercased', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

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

  test('gpu experimental should collect GPU data', async () => {
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
      apiPort: 10434,
      experimentalTuning: false,
      modelUploadDisabled: false,
      showGPUPromotion: false,
    });

    vi.mocked(gpuManager.collectGPUs).mockResolvedValue([
      {
        vram: 1024,
        model: 'nvidia',
        vendor: GPUVendor.NVIDIA,
      },
    ]);

    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
    const server = await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(
      DummyImageInfo.engineId,
      expect.objectContaining({
        Cmd: [
          '-c',
          '/usr/bin/ln -sfn /usr/lib/wsl/lib/* /usr/lib64/ && PATH="${PATH}:/usr/lib/wsl/lib/" && chmod 755 ./run.sh && ./run.sh',
        ],
      }),
    );
    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(expect.anything(), llamacpp.cuda, expect.any(Function));
    expect('gpu' in server.labels).toBeTruthy();
    expect(server.labels['gpu']).toBe('nvidia');
  });

  test('gpu experimental should collect GPU data and find first supported gpu - entry 1 supported', async () => {
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
      apiPort: 10434,
      experimentalTuning: false,
      modelUploadDisabled: false,
      showGPUPromotion: false,
    });

    vi.mocked(gpuManager.collectGPUs).mockResolvedValue([
      {
        vram: 1024,
        model: 'dummy-model',
        vendor: GPUVendor.UNKNOWN,
      },
      {
        vram: 1024,
        model: 'nvidia',
        vendor: GPUVendor.NVIDIA,
      },
    ]);

    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
    const server = await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(
      DummyImageInfo.engineId,
      expect.objectContaining({
        Cmd: [
          '-c',
          '/usr/bin/ln -sfn /usr/lib/wsl/lib/* /usr/lib64/ && PATH="${PATH}:/usr/lib/wsl/lib/" && chmod 755 ./run.sh && ./run.sh',
        ],
      }),
    );
    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(expect.anything(), llamacpp.cuda, expect.any(Function));
    expect('gpu' in server.labels).toBeTruthy();
    expect(server.labels['gpu']).toBe('nvidia');
  });

  test('gpu experimental should collect GPU data and find first supported gpu - entry 0 supported', async () => {
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
      apiPort: 10434,
      experimentalTuning: false,
      modelUploadDisabled: false,
      showGPUPromotion: false,
    });

    vi.mocked(gpuManager.collectGPUs).mockResolvedValue([
      {
        vram: 1024,
        model: 'nvidia',
        vendor: GPUVendor.NVIDIA,
      },
      {
        vram: 1024,
        model: 'dummy-model',
        vendor: GPUVendor.UNKNOWN,
      },
    ]);

    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
    const server = await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(
      DummyImageInfo.engineId,
      expect.objectContaining({
        Cmd: [
          '-c',
          '/usr/bin/ln -sfn /usr/lib/wsl/lib/* /usr/lib64/ && PATH="${PATH}:/usr/lib/wsl/lib/" && chmod 755 ./run.sh && ./run.sh',
        ],
      }),
    );
    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(expect.anything(), llamacpp.cuda, expect.any(Function));
    expect('gpu' in server.labels).toBeTruthy();
    expect(server.labels['gpu']).toBe('nvidia');
  });

  test('unknown gpu on unsupported vmtype should not provide gpu labels', async () => {
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
      apiPort: 10434,
      experimentalTuning: false,
      modelUploadDisabled: false,
      showGPUPromotion: false,
    });

    vi.mocked(gpuManager.collectGPUs).mockResolvedValue([
      {
        vram: 1024,
        model: 'dummy-model',
        vendor: GPUVendor.UNKNOWN,
      },
    ]);

    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
    const server = await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect('gpu' in server.labels).toBeFalsy();
  });

  test('LIBKRUN vmtype should uses llamacpp.vulkan image', async () => {
    vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue({
      ...dummyConnection,
      vmType: VMType.LIBKRUN,
    });
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
      apiPort: 10434,
      experimentalTuning: false,
      modelUploadDisabled: false,
      showGPUPromotion: false,
    });

    vi.mocked(gpuManager.collectGPUs).mockResolvedValue([
      {
        vram: 1024,
        model: 'dummy-model',
        vendor: GPUVendor.APPLE,
      },
    ]);

    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);
    const server = await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: undefined,
    });

    expect(getImageInfo).toHaveBeenCalledWith(expect.anything(), llamacpp.vulkan, expect.any(Function));
    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect('gpu' in server.labels).toBeTruthy();
  });

  test('provided connection should be used for pulling the image', async () => {
    const connection: ContainerProviderConnectionInfo = {
      name: 'Dummy Podman',
      type: 'podman',
      vmType: VMType.WSL,
      status: 'started',
      providerId: 'fakeProviderId',
    };
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

    await provider.perform({
      port: 8000,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      connection: connection,
    });

    expect(podmanConnection.getContainerProviderConnection).toHaveBeenCalledWith(connection);
    expect(podmanConnection.findRunningContainerProviderConnection).not.toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(dummyConnection, llamacpp.default, expect.anything());
  });
});
