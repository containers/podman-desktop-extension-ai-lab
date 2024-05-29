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

import { beforeEach, describe, vi, expect, test } from 'vitest';
import { PodManager } from './PodManager';
import type { ContainerInspectInfo, ContainerJSONEvent, PodCreateOptions, PodInfo } from '@podman-desktop/api';
import { EventEmitter , containerEngine } from '@podman-desktop/api';

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    listPods: vi.fn(),
    stopPod: vi.fn(),
    removePod: vi.fn(),
    startPod: vi.fn(),
    createPod: vi.fn(),
    inspectContainer: vi.fn(),
    onEvent: vi.fn(),
  },
  EventEmitter: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  // we return the id as health status
  vi.mocked(containerEngine.inspectContainer).mockImplementation(async (engineId: string, id: string) => {
    return {
      State: {
        Health: {
          Status: id,
        },
      },
    } as unknown as ContainerInspectInfo;
  });

  // mocking the EventEmitter mechanism
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

test('getAllPods should use container engine list pods method', async () => {
  await new PodManager().getAllPods();

  expect(containerEngine.listPods).toHaveBeenCalledOnce();
});

test('findPodByLabelsValues should only return pods with labels matching values', async () => {
  vi.mocked(containerEngine.listPods).mockResolvedValue([
    {
      Id: 'pod-id-1',
      Labels: {
        'dummy-key': 'dummy-invalid',
        hello: 'eggs',
      },
    },
    {
      Id: 'pod-id-2',
      Labels: {
        hello: 'world',
        'dummy-key': 'dummy-valid',
      },
    },
    {
      Id: 'pod-id-2',
      Labels: {
        hello: 'world',
        'dummy-key': 'invalid',
      },
    },
    {
      Id: 'pod-id-3',
    },
  ] as unknown as PodInfo[]);

  const pod = await new PodManager().findPodByLabelsValues({
    'dummy-key': 'dummy-valid',
    hello: 'world',
  });
  expect(pod).toBeDefined();
  expect(pod?.Id).toBe('pod-id-2');
});

test('getPodsWithLabels should only return pods with proper labels', async () => {
  vi.mocked(containerEngine.listPods).mockResolvedValue([
    {
      Id: 'pod-id-1',
      Labels: {
        'dummy-key': 'dummy-value',
        hello: 'world',
      },
    },
    {
      Id: 'pod-id-2',
      Labels: {
        hello: 'world',
        'dummy-key': 'dummy-value',
      },
    },
    {
      Id: 'pod-id-3',
    },
  ] as unknown as PodInfo[]);
  const pods = await new PodManager().getPodsWithLabels(['dummy-key']);
  expect(pods.length).toBe(2);
  expect(pods.find(pod => pod.Id === 'pod-id-1')).toBeDefined();
  expect(pods.find(pod => pod.Id === 'pod-id-2')).toBeDefined();
  expect(pods.find(pod => pod.Id === 'pod-id-3')).toBeUndefined();
});

describe('getHealth', () => {
  test('getHealth with no container should be none', async () => {
    const health = await new PodManager().getHealth({
      Containers: [],
    } as unknown as PodInfo);
    expect(health).toBe('none');
  });

  test('getHealth with one healthy should be healthy', async () => {
    const health = await new PodManager().getHealth({
      Containers: [
        {
          Id: 'healthy',
        },
      ],
    } as unknown as PodInfo);
    expect(health).toBe('healthy');
  });

  test('getHealth with many healthy and one unhealthy should be unhealthy', async () => {
    const health = await new PodManager().getHealth({
      Containers: [
        {
          Id: 'healthy',
        },
        {
          Id: 'unhealthy',
        },
        {
          Id: 'healthy',
        },
        {
          Id: 'starting',
        },
      ],
    } as unknown as PodInfo);
    expect(health).toBe('unhealthy');
  });

  test('getHealth with many healthy and one starting should be starting', async () => {
    const health = await new PodManager().getHealth({
      Containers: [
        {
          Id: 'healthy',
        },
        {
          Id: 'healthy',
        },
        {
          Id: 'starting',
        },
      ],
    } as unknown as PodInfo);
    expect(health).toBe('starting');
  });
});

describe('getPod', () => {
  test('getPod should throw an error if none is matching', async () => {
    vi.mocked(containerEngine.listPods).mockResolvedValue([]);
    await expect(async () => {
      await new PodManager().getPod('fakeEngineId', 'fakePodId');
    }).rejects.toThrowError('pod with engineId fakeEngineId and Id fakePodId cannot be found.');
  });

  test('getPod should return matching pod', async () => {
    vi.mocked(containerEngine.listPods).mockResolvedValue([
      {
        engineId: 'engine-1',
        Id: 'pod-id-1',
        Labels: {
          'dummy-key': 'dummy-value',
          hello: 'world',
        },
      },
      {
        engineId: 'engine-2',
        Id: 'pod-id-2',
        Labels: {
          hello: 'world',
          'dummy-key': 'dummy-value',
        },
      },
      {
        engineId: 'engine-3',
        Id: 'pod-id-3',
      },
    ] as unknown as PodInfo[]);
    const pod = await new PodManager().getPod('engine-3', 'pod-id-3');
    expect(pod).toBeDefined();
    expect(pod.engineId).toBe('engine-3');
    expect(pod.Id).toBe('pod-id-3');
  });
});

test('stopPod should call containerEngine.stopPod', async () => {
  await new PodManager().stopPod('dummy-engine-id', 'dummy-pod-id');
  expect(containerEngine.stopPod).toHaveBeenCalledWith('dummy-engine-id', 'dummy-pod-id');
});

test('removePod should call containerEngine.removePod', async () => {
  await new PodManager().removePod('dummy-engine-id', 'dummy-pod-id');
  expect(containerEngine.removePod).toHaveBeenCalledWith('dummy-engine-id', 'dummy-pod-id');
});

test('startPod should call containerEngine.startPod', async () => {
  await new PodManager().startPod('dummy-engine-id', 'dummy-pod-id');
  expect(containerEngine.startPod).toHaveBeenCalledWith('dummy-engine-id', 'dummy-pod-id');
});

test('createPod should call containerEngine.createPod', async () => {
  const options: PodCreateOptions = {
    name: 'dummy-name',
    portmappings: [],
  };
  await new PodManager().createPod(options);
  expect(containerEngine.createPod).toHaveBeenCalledWith(options);
});

test('dispose should dispose onEvent disposable', () => {
  const disposableMock = vi.fn();
  vi.mocked(containerEngine.onEvent).mockImplementation(() => {
    return { dispose: disposableMock };
  });

  const podManager = new PodManager();
  podManager.init();

  podManager.dispose();

  expect(containerEngine.onEvent).toHaveBeenCalled();
  expect(disposableMock).toHaveBeenCalled();
});

const getInitializedPodManager = (): {
  onEventListener: (e: ContainerJSONEvent) => unknown;
  podManager: PodManager;
} => {
  let func: ((e: ContainerJSONEvent) => unknown) | undefined = undefined;
  vi.mocked(containerEngine.onEvent).mockImplementation(fn => {
    func = fn;
    return { dispose: vi.fn() };
  });

  const podManager = new PodManager();
  podManager.init();

  if (!func) throw new Error('listener should be defined');

  return { onEventListener: func, podManager };
};

describe('events', () => {
  test('onStartPodEvent listener should be called on start pod event', async () => {
    vi.mocked(containerEngine.listPods).mockResolvedValue([
      {
        Id: 'pod-id-1',
        Labels: {
          'dummy-key': 'dummy-value',
          hello: 'world',
        },
      },
    ] as unknown as PodInfo[]);

    const { onEventListener, podManager } = getInitializedPodManager();

    const startListenerMock = vi.fn();
    podManager.onStartPodEvent(startListenerMock);

    onEventListener({ id: 'pod-id-1', Type: 'pod', type: '', status: 'start' });

    await vi.waitFor(() => {
      expect(startListenerMock).toHaveBeenCalledWith({
        Id: 'pod-id-1',
        Labels: {
          'dummy-key': 'dummy-value',
          hello: 'world',
        },
      });
    });
  });

  test('onStopPodEvent listener should be called on start pod event', async () => {
    vi.mocked(containerEngine.listPods).mockResolvedValue([
      {
        Id: 'pod-id-1',
        Labels: {
          'dummy-key': 'dummy-value',
          hello: 'world',
        },
      },
    ] as unknown as PodInfo[]);

    const { onEventListener, podManager } = getInitializedPodManager();

    const stopListenerMock = vi.fn();
    podManager.onStopPodEvent(stopListenerMock);

    onEventListener({ id: 'pod-id-1', Type: 'pod', type: '', status: 'stop' });

    await vi.waitFor(() => {
      expect(stopListenerMock).toHaveBeenCalledWith({
        Id: 'pod-id-1',
        Labels: {
          'dummy-key': 'dummy-value',
          hello: 'world',
        },
      });
    });
  });

  test('onRemovePodEvent listener should be called on start pod event', async () => {
    const { onEventListener, podManager } = getInitializedPodManager();

    const removeListenerMock = vi.fn();
    podManager.onRemovePodEvent(removeListenerMock);

    onEventListener({ id: 'pod-id-1', Type: 'pod', type: '', status: 'remove' });

    await vi.waitFor(() => {
      expect(removeListenerMock).toHaveBeenCalledWith({
        podId: 'pod-id-1',
      });
    });
    expect(containerEngine.listPods).not.toHaveBeenCalled();
  });
});
