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
import { EventEmitter } from '@podman-desktop/api';
import type { TelemetryLogger } from '@podman-desktop/api';
import { beforeEach, expect, test, vi } from 'vitest';
import { ModelsManager } from '../managers/modelsManager';
import type { CatalogManager } from '../managers/catalogManager';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { TaskRegistry } from '../registries/TaskRegistry';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import type { PodmanConnection } from '../managers/podmanConnection';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import { ModelHandlerRegistry } from '../registries/ModelHandlerRegistry';
import { HuggingFaceModelHandler } from './HuggingFaceModelHandler';
import { snapshotDownload } from '@huggingface/hub';
import type { RpcExtension } from '@shared/messages/MessageProxy';

vi.mock('@podman-desktop/api', () => {
  return {
    EventEmitter: vi.fn(),
  };
});

vi.mock('@huggingface/hub', () => {
  return {
    scanCacheDir: vi.fn(),
    snapshotDownload: vi.fn(),
  };
});

const rpcExtensionMock = {
  fire: vi.fn(),
} as unknown as RpcExtension;

const catalogManagerMock = {
  getModels(): ModelInfo[] {
    return [
      { id: 'model-id-1', name: 'model-id-1-model' } as ModelInfo,
      { id: 'model-id-2', name: 'model-id-2-model' } as ModelInfo,
    ];
  },
  onUpdate: vi.fn(),
} as unknown as CatalogManager;

const telemetryLogger = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const taskRegistry: TaskRegistry = new TaskRegistry(rpcExtensionMock);

const cancellationTokenRegistryMock = {
  createCancellationTokenSource: vi.fn(),
} as unknown as CancellationTokenRegistry;

const podmanConnectionMock = {
  getContainerProviderConnections: vi.fn(),
} as unknown as PodmanConnection;

const configurationRegistryMock = {
  getExtensionConfiguration: vi.fn(),
} as unknown as ConfigurationRegistry;

const modelHandlerRegistry = new ModelHandlerRegistry(rpcExtensionMock);

const modelsManager: ModelsManager = new ModelsManager(
  rpcExtensionMock,
  catalogManagerMock,
  telemetryLogger,
  taskRegistry,
  cancellationTokenRegistryMock,
  podmanConnectionMock,
  configurationRegistryMock,
  modelHandlerRegistry,
);

const huggingFaceModelHandler = new HuggingFaceModelHandler(modelsManager);

beforeEach(() => {
  const listeners: ((value: unknown) => void)[] = [];

  const eventReturned = {
    event: vi.fn(),
    fire: vi.fn(),
  };

  vi.mocked(EventEmitter).mockReturnValue(eventReturned as unknown as EventEmitter<unknown>);
  vi.mocked(eventReturned.event).mockImplementation(callback => {
    listeners.push(callback);
  });
  vi.mocked(eventReturned.fire).mockImplementation((content: unknown) => {
    listeners.forEach(listener => listener(content));
  });
});

test('check http url are not supported', () => {
  expect(huggingFaceModelHandler.accept('http://example.com')).toBe(false);
});

test('check https url are not supported', () => {
  expect(huggingFaceModelHandler.accept('http://example.com')).toBe(false);
});

test('check huggingface url are supported', () => {
  expect(huggingFaceModelHandler.accept('huggingface://ibm-granite/my-model')).toBe(true);
});

test('download reports error', async () => {
  vi.mocked(snapshotDownload).mockRejectedValue(new Error('error'));
  const listenerMock = vi.fn();
  const downloader = huggingFaceModelHandler.createDownloader(
    { id: 'model-id-1', name: 'model-id-1-model', url: 'huggingface://ibm-granite/my-model' } as ModelInfo,
    { aborted: false } as AbortSignal,
  );
  downloader.onEvent(listenerMock);
  let err: unknown;
  try {
    await downloader.perform('model-id-1');
  } catch (error) {
    err = error;
  }
  expect(err).toBeDefined();
  expect(listenerMock).toHaveBeenCalledWith({
    id: 'model-id-1',
    message: 'Something went wrong: Error: error.',
    status: 'error',
  });
});

test('download returns cache in path', async () => {
  vi.mocked(snapshotDownload).mockResolvedValue('cache-path');
  const listenerMock = vi.fn();
  const downloader = huggingFaceModelHandler.createDownloader(
    { id: 'model-id-1', name: 'model-id-1-model', url: 'huggingface://ibm-granite/my-model' } as ModelInfo,
    { aborted: false } as AbortSignal,
  );
  downloader.onEvent(listenerMock);
  await downloader.perform('model-id-1');
  expect(downloader.getTarget()).toBe('cache-path');
  expect(listenerMock).toHaveBeenCalledWith({
    duration: expect.anything(),
    id: 'model-id-1',
    message: expect.anything(),
    status: 'completed',
  });
});
