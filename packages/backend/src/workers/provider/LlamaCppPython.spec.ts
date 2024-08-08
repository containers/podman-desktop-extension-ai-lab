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
import { LLAMA_CPP_CPU, LLAMA_CPP_CUDA, LlamaCppPython, SECOND } from './LlamaCppPython';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getImageInfo, getProviderContainerConnection, LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { ContainerProviderConnection, ImageInfo, ProviderContainerConnection } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { GPUManager } from '../../managers/GPUManager';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { VMType } from '@shared/src/models/IPodman';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { GPUVendor } from '@shared/src/models/IGPUInfo';
import type { InferenceServer } from '@shared/src/models/IInference';
import { InferenceType } from '@shared/src/models/IInference';

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

const DummyProviderContainerConnection: ProviderContainerConnection = {
  providerId: 'dummy-provider-id',
  connection: {
    name: 'dummy-provider-connection',
    type: 'podman',
  } as unknown as ContainerProviderConnection,
};

const DummyImageInfo: ImageInfo = {
  Id: 'dummy-image-id',
  engineId: 'dummy-engine-id',
} as unknown as ImageInfo;

const podmanConnection: PodmanConnection = {
  getVMType: vi.fn(),
} as unknown as PodmanConnection;

const configurationRegistry: ConfigurationRegistry = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
    experimentalGPU: false,
    modelsPath: 'model-path',
  });
  vi.mocked(podmanConnection.getVMType).mockResolvedValue(VMType.WSL);
  vi.mocked(getProviderContainerConnection).mockReturnValue(DummyProviderContainerConnection);
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
      providerId: undefined,
    });

    expect(getProviderContainerConnection).toHaveBeenCalledWith(undefined);
    expect(getImageInfo).toHaveBeenCalledWith(
      DummyProviderContainerConnection.connection,
      LLAMA_CPP_CPU,
      expect.anything(),
    );
  });

  test('config without models should throw an error', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection, gpuManager, configurationRegistry);

    await expect(
      provider.perform({
        port: 8000,
        image: undefined,
        labels: {},
        modelsInfo: [],
        providerId: undefined,
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
        providerId: undefined,
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
      providerId: undefined,
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
      providerId: undefined,
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
      providerId: undefined,
    });

    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect(getImageInfo).toHaveBeenCalledWith(expect.anything(), LLAMA_CPP_CUDA, expect.any(Function));
    expect('gpu' in server.labels).toBeTruthy();
    expect(server.labels['gpu']).toBe('nvidia');
  });

  test('unknown gpu on unsupported vmtype should not provide gpu labels', async () => {
    vi.mocked(configurationRegistry.getExtensionConfiguration).mockReturnValue({
      experimentalGPU: true,
      modelsPath: '',
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
      providerId: undefined,
    });

    expect(gpuManager.collectGPUs).toHaveBeenCalled();
    expect('gpu' in server.labels).toBeFalsy();
  });
});
