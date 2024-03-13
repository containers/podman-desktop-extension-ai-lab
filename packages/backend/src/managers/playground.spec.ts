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

import { beforeEach, afterEach, expect, test, vi, describe, beforeAll } from 'vitest';
import { LABEL_MODEL_ID, LABEL_MODEL_PORT, PlayGroundManager } from './playground';
import type { PodmanConnection, machineStopHandle, startupHandle } from './podmanConnection';
import type { ContainerRegistry } from '../registries/ContainerRegistry';
import type { ImageInfo, TelemetryLogger, Webview } from '@podman-desktop/api';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../utils/utils';

const mocks = vi.hoisted(() => ({
  postMessage: vi.fn(),
  getContainerConnections: vi.fn(),
  pullImage: vi.fn(),
  createContainer: vi.fn(),
  stopContainer: vi.fn(),
  getFreePort: vi.fn(),
  containerRegistrySubscribeMock: vi.fn(),
  startupSubscribe: vi.fn(),
  onMachineStop: vi.fn(),
  listContainers: vi.fn(),
  logUsage: vi.fn(),
  logError: vi.fn(),
  getFirstRunningPodmanConnectionMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    provider: {
      getContainerConnections: mocks.getContainerConnections,
    },
    containerEngine: {
      pullImage: mocks.pullImage,
      createContainer: mocks.createContainer,
      stopContainer: mocks.stopContainer,
      listContainers: mocks.listContainers,
    },
  };
});

vi.mock('../utils/podman', () => {
  return {
    getFirstRunningPodmanConnection: mocks.getFirstRunningPodmanConnectionMock,
  };
});

const containerRegistryMock = {
  subscribe: mocks.containerRegistrySubscribeMock,
} as unknown as ContainerRegistry;

vi.mock('../utils/ports', async () => {
  return {
    getFreePort: mocks.getFreePort,
  };
});

let manager: PlayGroundManager;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  vi.resetAllMocks();

  manager = new PlayGroundManager(
    {
      postMessage: mocks.postMessage,
    } as unknown as Webview,
    containerRegistryMock,
    {
      startupSubscribe: mocks.startupSubscribe,
      onMachineStop: mocks.onMachineStop,
    } as unknown as PodmanConnection,
    {
      logUsage: mocks.logUsage,
      logError: mocks.logError,
    } as unknown as TelemetryLogger,
  );
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn().mockResolvedValue({});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('startPlayground should fail if no provider', async () => {
  mocks.postMessage.mockResolvedValue(undefined);
  mocks.getContainerConnections.mockReturnValue([]);
  await expect(manager.startPlayground('model1', '/path/to/model')).rejects.toThrowError(
    'Unable to find an engine to start playground',
  );
});

test('startPlayground should download image if not present then create container', async () => {
  mocks.postMessage.mockResolvedValue(undefined);
  mocks.getFirstRunningPodmanConnectionMock.mockReturnValue({
    connection: {
      type: 'podman',
      status: () => 'started',
    },
  });
  vi.spyOn(manager, 'selectImage')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({
      Id: 'image1',
      engineId: 'engine1',
    } as ImageInfo);
  mocks.createContainer.mockReturnValue({
    id: 'container1',
  });
  mocks.getFreePort.mockResolvedValue(8085);
  await manager.startPlayground('model1', '/path/to/model');
  expect(mocks.pullImage).toHaveBeenCalledOnce();
  expect(mocks.createContainer).toHaveBeenNthCalledWith(1, 'engine1', {
    Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
    Detach: true,
    Env: ['MODEL_PATH=/models/model'],
    ExposedPorts: {
      '8085': {},
    },
    HostConfig: {
      AutoRemove: true,
      Mounts: [
        {
          Source: '/path/to',
          Target: '/models',
          Type: 'bind',
        },
      ],
      SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
      PortBindings: {
        '8000/tcp': [
          {
            HostPort: '8085',
          },
        ],
      },
    },
    Image: 'image1',
    Labels: {
      'ai-studio-model-id': 'model1',
      'ai-studio-model-port': '8085',
    },
  });
});

test('stopPlayground should fail if no playground is running', async () => {
  await expect(manager.stopPlayground('unknown-model')).rejects.toThrowError('model is not running');
});

test('stopPlayground should stop a started playground', async () => {
  mocks.postMessage.mockResolvedValue(undefined);
  mocks.getFirstRunningPodmanConnectionMock.mockReturnValue({
    connection: {
      type: 'podman',
      status: () => 'started',
    },
  });
  vi.spyOn(manager, 'selectImage').mockResolvedValue({
    Id: 'image1',
    engineId: 'engine1',
  } as ImageInfo);
  mocks.createContainer.mockReturnValue({
    id: 'container1',
  });
  mocks.stopContainer.mockResolvedValue(undefined);
  mocks.getFreePort.mockResolvedValue(8085);
  await manager.startPlayground('model1', '/path/to/model');
  await manager.stopPlayground('model1');
  expect(mocks.stopContainer).toHaveBeenNthCalledWith(1, 'engine1', 'container1');
});

test('adoptRunningPlaygrounds updates the playground state with the found container', async () => {
  mocks.listContainers.mockResolvedValue([
    {
      Id: 'container-id-1',
      engineId: 'engine-id-1',
      Labels: {
        [LABEL_MODEL_ID]: 'model-id-1',
        [LABEL_MODEL_PORT]: '8080',
      },
      State: 'running',
    },
  ]);
  mocks.startupSubscribe.mockImplementation((f: startupHandle) => {
    f();
  });
  const updatePlaygroundStateSpy = vi.spyOn(manager, 'updatePlaygroundState');
  manager.adoptRunningPlaygrounds();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(updatePlaygroundStateSpy).toHaveBeenNthCalledWith(1, 'model-id-1', {
    container: {
      containerId: 'container-id-1',
      engineId: 'engine-id-1',
      port: 8080,
    },
    modelId: 'model-id-1',
    status: 'running',
  });
});

test('onMachineStop updates the playground state with no playground running', async () => {
  mocks.listContainers.mockResolvedValue([]);
  mocks.onMachineStop.mockImplementation((f: machineStopHandle) => {
    f();
  });
  const sendPlaygroundStateSpy = vi.spyOn(manager, 'sendPlaygroundState').mockResolvedValue();
  manager.adoptRunningPlaygrounds();
  expect(sendPlaygroundStateSpy).toHaveBeenCalledOnce();
});

test('playground error not overwritten', async () => {
  mocks.postMessage.mockResolvedValue(undefined);

  const states = manager.getPlaygroundsState();
  expect(states.length).toBe(0);

  manager.setPlaygroundError('random', 'first');
  expect(manager.getPlaygroundsState().length).toBe(1);

  expect(manager.getPlaygroundsState()[0].error).toBe('first');

  manager.setPlaygroundError('random', 'second');
  expect(manager.getPlaygroundsState()[0].error).toBe('first');
});

test('error cleared when status changed', async () => {
  mocks.postMessage.mockResolvedValue(undefined);

  const states = manager.getPlaygroundsState();
  expect(states.length).toBe(0);

  manager.setPlaygroundError('random', 'error-msg');
  manager.setPlaygroundStatus('random', 'running');

  expect(manager.getPlaygroundsState()[0].error).toBeUndefined();
});

describe('askPlayground tests', () => {
  const mockCreate = vi.fn();
  beforeAll(() => {
    vi.mock('openai');
  });

  test('askPlayground should send total duration to telemetry', async () => {
    vi.mocked(OpenAI).mockReturnValue({
      completions: {
        create: mockCreate,
      },
    } as unknown as OpenAI);
    mockCreate.mockReturnValue(
      Stream.fromReadableStream(
        new ReadableStream({
          start(controller): void {
            controller.enqueue('{ "id": "chunk1", "choices": [ { "finish_reason": "end" } ] }');
            controller.close();
          },
        }),
        undefined,
      ),
    );
    mocks.postMessage.mockResolvedValue(undefined);
    manager.updatePlaygroundState('model1', {
      modelId: 'model1',
      status: 'running',
      container: { containerId: 'container1', engineId: 'podman', port: 8000 },
    });
    await manager.askPlayground({ id: 'model1', file: { file: 'a-file' } } as unknown as ModelInfo, 'question?');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mocks.logUsage).toHaveBeenCalledWith('playground.ask', {
      'model.id': 'model1',
      responseDurationSeconds: expect.any(Number),
    });
  });
});
