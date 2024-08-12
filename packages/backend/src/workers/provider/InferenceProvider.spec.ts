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
import { type BetterContainerCreateResult, InferenceProvider } from './InferenceProvider';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { ContainerCreateOptions, ContainerProviderConnection, ImageInfo } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { TaskState } from '@shared/src/models/ITask';
import type { InferenceServer } from '@shared/src/models/IInference';
import { InferenceType } from '@shared/src/models/IInference';

vi.mock('../../utils/inferenceUtils', () => ({
  getImageInfo: vi.fn(),
  LABEL_INFERENCE_SERVER: 'ai-lab-inference-server',
}));

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    createContainer: vi.fn(),
  },
}));

const DummyImageInfo: ImageInfo = {
  Id: 'dummy-image-id',
  engineId: 'dummy-engine-id',
} as unknown as ImageInfo;

const taskRegistry: TaskRegistry = {
  createTask: vi.fn(),
  updateTask: vi.fn(),
} as unknown as TaskRegistry;

const connectionMock: ContainerProviderConnection = {
  name: 'Dummy Connection',
  type: 'podman',
} as unknown as ContainerProviderConnection;

class TestInferenceProvider extends InferenceProvider {
  constructor() {
    super(taskRegistry, InferenceType.NONE, 'test-inference-provider');
  }

  enabled(): boolean {
    throw new Error('not implemented');
  }

  publicPullImage(connection: ContainerProviderConnection, image: string, labels: { [id: string]: string }) {
    return super.pullImage(connection, image, labels);
  }

  async publicCreateContainer(
    engineId: string,
    containerCreateOptions: ContainerCreateOptions,
    labels: { [id: string]: string } = {},
  ): Promise<BetterContainerCreateResult> {
    const result = await this.createContainer(engineId, containerCreateOptions, labels);
    return {
      id: result.id,
      engineId: engineId,
    };
  }

  async perform(_config: InferenceServerConfig): Promise<InferenceServer> {
    throw new Error('not implemented');
  }
  dispose(): void {}
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getImageInfo).mockResolvedValue(DummyImageInfo);
  vi.mocked(taskRegistry.createTask).mockImplementation(
    (name: string, state: TaskState, labels: { [id: string]: string } = {}) => ({
      id: 'dummy-task-id',
      name: name,
      state: state,
      labels: labels,
    }),
  );
  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummy-container-id',
    engineId: 'dummy-engine-id',
  });
});

describe('pullImage', () => {
  test('should create a task and mark as success on completion', async () => {
    const provider = new TestInferenceProvider();
    await provider.publicPullImage(connectionMock, 'dummy-image', {
      key: 'value',
    });

    expect(taskRegistry.createTask).toHaveBeenCalledWith('Pulling dummy-image.', 'loading', {
      key: 'value',
    });

    expect(taskRegistry.updateTask).toHaveBeenCalledWith({
      id: 'dummy-task-id',
      name: 'Pulling dummy-image.',
      labels: {
        key: 'value',
      },
      state: 'success',
    });
  });

  test('should mark the task as error when pulling failed', async () => {
    const provider = new TestInferenceProvider();
    vi.mocked(getImageInfo).mockRejectedValue(new Error('dummy test error'));

    await expect(
      provider.publicPullImage(connectionMock, 'dummy-image', {
        key: 'value',
      }),
    ).rejects.toThrowError('dummy test error');

    expect(taskRegistry.updateTask).toHaveBeenCalledWith({
      id: 'dummy-task-id',
      name: 'Pulling dummy-image.',
      labels: {
        key: 'value',
      },
      state: 'error',
      error: 'Something went wrong while pulling dummy-image: Error: dummy test error',
    });
  });
});

describe('createContainer', () => {
  test('should create a task and mark as success on completion', async () => {
    const provider = new TestInferenceProvider();
    await provider.publicCreateContainer(
      'dummy-engine-id',
      {
        name: 'dummy-container-name',
      },
      {
        key: 'value',
      },
    );

    expect(taskRegistry.createTask).toHaveBeenCalledWith('Creating container.', 'loading', {
      key: 'value',
    });

    expect(taskRegistry.updateTask).toHaveBeenCalledWith({
      id: 'dummy-task-id',
      name: 'Creating container.',
      labels: {
        key: 'value',
      },
      state: 'success',
    });
  });

  test('should mark the task as error when creation failed', async () => {
    const provider = new TestInferenceProvider();
    vi.mocked(containerEngine.createContainer).mockRejectedValue(new Error('dummy test error'));

    await expect(
      provider.publicCreateContainer(
        'dummy-provider-id',
        {
          name: 'dummy-container-name',
        },
        {
          key: 'value',
        },
      ),
    ).rejects.toThrowError('dummy test error');

    expect(taskRegistry.updateTask).toHaveBeenCalledWith({
      id: 'dummy-task-id',
      name: 'Creating container.',
      labels: {
        key: 'value',
      },
      state: 'error',
      error: 'Something went wrong while creating container: Error: dummy test error',
    });
  });
});
