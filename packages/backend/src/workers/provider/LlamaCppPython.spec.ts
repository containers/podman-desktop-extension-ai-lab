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

import { vi, describe, test, expect, beforeEach } from 'vitest';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { LLAMA_CPP_INFERENCE_IMAGE, LlamaCppPython, SECOND } from './LlamaCppPython';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getImageInfo, getProviderContainerConnection } from '../../utils/inferenceUtils';
import type { ContainerProviderConnection, ImageInfo, ProviderContainerConnection } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { VMType } from '@shared/src/models/IPodman';

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
  hw: 'dummy-hardware',
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
  getVMType: vi.fn().mockResolvedValue(VMType.WSL),
} as unknown as PodmanConnection;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getProviderContainerConnection).mockReturnValue(DummyProviderContainerConnection);
  vi.mocked(getImageInfo).mockResolvedValue(DummyImageInfo);
  vi.mocked(taskRegistry.createTask).mockReturnValue({ id: 'dummy-task-id', name: '', labels: {}, state: 'loading' });
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummy-container-id',
  });
});

test('LlamaCppPython being the default, it should always be enable', () => {
  const provider = new LlamaCppPython(taskRegistry, podmanConnection);
  expect(provider.enabled()).toBeTruthy();
});

describe('perform', () => {
  test('config without image should use defined image', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection);

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
      LLAMA_CPP_INFERENCE_IMAGE,
      expect.anything(),
    );
  });

  test('config without models should throw an error', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection);

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
    const provider = new LlamaCppPython(taskRegistry, podmanConnection);

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
    const provider = new LlamaCppPython(taskRegistry, podmanConnection);

    await provider.perform({
      port: 8888,
      image: undefined,
      labels: {},
      modelsInfo: [DummyModel],
      providerId: undefined,
    });

    expect(containerEngine.createContainer).toHaveBeenCalledWith(DummyImageInfo.engineId, {
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
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
        Devices: [],
        Mounts: [
          {
            Source: 'dummy-path',
            Target: '/models',
            Type: 'bind',
          },
        ],
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
        'ai-lab-inference-server': `["${DummyModel.id}"]`,
      },
    });
  });

  test('model properties should be made uppercased', async () => {
    const provider = new LlamaCppPython(taskRegistry, podmanConnection);

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
});
