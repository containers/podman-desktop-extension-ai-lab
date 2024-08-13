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

import { vi, test, expect, beforeEach } from 'vitest';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { WhisperCpp } from './WhisperCpp';
import type { InferenceServer } from '@shared/src/models/IInference';
import { InferenceType } from '@shared/src/models/IInference';
import type { ContainerProviderConnection, ImageInfo } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { PodmanConnection } from '../../managers/podmanConnection';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
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

const connectionMock: ContainerProviderConnection = {
  name: 'dummy-provider-connection',
  type: 'podman',
} as unknown as ContainerProviderConnection;

const DummyImageInfo: ImageInfo = {
  Id: 'dummy-image-id',
  engineId: 'dummy-engine-id',
} as unknown as ImageInfo;

const taskRegistry: TaskRegistry = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
} as unknown as TaskRegistry;

const podmanConnection: PodmanConnection = {
  findRunningContainerProviderConnection: vi.fn(),
  getContainerProviderConnection: vi.fn(),
} as unknown as PodmanConnection;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(podmanConnection.findRunningContainerProviderConnection).mockReturnValue(connectionMock);
  vi.mocked(podmanConnection.getContainerProviderConnection).mockReturnValue(connectionMock);
  vi.mocked(taskRegistry.createTask).mockReturnValue({ id: 'dummy-task-id', name: '', labels: {}, state: 'loading' });

  vi.mocked(getImageInfo).mockResolvedValue(DummyImageInfo);
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummy-container-id',
    engineId: 'dummy-engine-id',
  });
});

test('provider requires at least one model', async () => {
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  await expect(() => {
    return provider.perform({
      port: 8888,
      labels: {},
      modelsInfo: [],
    });
  }).rejects.toThrowError('Need at least one model info to start an inference server.');
});

test('provider requires a downloaded model', async () => {
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  await expect(() => {
    return provider.perform({
      port: 8888,
      labels: {},
      modelsInfo: [
        {
          id: 'whisper-cpp',
          name: 'Whisper',
          properties: {},
          description: 'whisper desc',
        },
      ],
    });
  }).rejects.toThrowError('The model info file provided is undefined');
});

test('provider requires a model with backend type Whisper', async () => {
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  await expect(() => {
    return provider.perform({
      port: 8888,
      labels: {},
      modelsInfo: [
        {
          id: 'whisper-cpp',
          name: 'Whisper',
          properties: {},
          description: 'whisper desc',
          file: {
            file: 'random-file',
            path: 'path-to-file',
          },
          backend: InferenceType.LLAMA_CPP,
        },
      ],
    });
  }).rejects.toThrowError(
    `Whisper requires models with backend type ${InferenceType.WHISPER_CPP} got ${InferenceType.LLAMA_CPP}.`,
  );
});

test('custom image in inference server config should overwrite default', async () => {
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  const model = {
    id: 'whisper-cpp',
    name: 'Whisper',
    properties: {},
    description: 'whisper desc',
    file: {
      file: 'random-file',
      path: 'path-to-file',
    },
    backend: InferenceType.WHISPER_CPP,
  };

  await provider.perform({
    port: 8888,
    labels: {
      hello: 'world',
    },
    image: 'localhost/whisper-cpp:custom',
    modelsInfo: [model],
  });

  expect(getImageInfo).toHaveBeenCalledWith(connectionMock, 'localhost/whisper-cpp:custom', expect.any(Function));
});

test('provider should propagate labels', async () => {
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  const model = {
    id: 'whisper-cpp',
    name: 'Whisper',
    properties: {},
    description: 'whisper desc',
    file: {
      file: 'random-file',
      path: 'path-to-file',
    },
    backend: InferenceType.WHISPER_CPP,
  };

  const server: InferenceServer = await provider.perform({
    port: 8888,
    labels: {
      hello: 'world',
    },
    modelsInfo: [model],
  });

  expect(server).toStrictEqual({
    connection: {
      port: 8888,
    },
    container: {
      containerId: 'dummy-container-id',
      engineId: 'dummy-engine-id',
    },
    labels: {
      'ai-lab-inference-server': '["whisper-cpp"]',
      api: 'http://localhost:8888/inference',
      hello: 'world',
    },
    models: [model],
    status: 'running',
    type: InferenceType.WHISPER_CPP,
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
  const provider = new WhisperCpp(taskRegistry, podmanConnection);

  const model = {
    id: 'whisper-cpp',
    name: 'Whisper',
    properties: {},
    description: 'whisper desc',
    file: {
      file: 'random-file',
      path: 'path-to-file',
    },
    backend: InferenceType.WHISPER_CPP,
  };

  await provider.perform({
    connection: connection,
    port: 8888,
    labels: {
      hello: 'world',
    },
    image: 'localhost/whisper-cpp:custom',
    modelsInfo: [model],
  });

  expect(getImageInfo).toHaveBeenCalledWith(connectionMock, 'localhost/whisper-cpp:custom', expect.any(Function));
  expect(podmanConnection.getContainerProviderConnection).toHaveBeenCalledWith(connection);
  expect(podmanConnection.findRunningContainerProviderConnection).not.toHaveBeenCalled();
});
