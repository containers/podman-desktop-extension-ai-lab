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
import { expect, test, vi, beforeEach } from 'vitest';
import { containerEngine, env } from '@podman-desktop/api';
import type { ContainerInspectInfo, ContainerProviderConnection, ImageInfo, Webview } from '@podman-desktop/api';
import { GPUManager } from './GPUManager';
import { getImageInfo, getProviderContainerConnection } from '../utils/inferenceUtils';
import { XMLParser } from 'fast-xml-parser';

vi.mock('../utils/inferenceUtils', () => ({
  getProviderContainerConnection: vi.fn(),
  getImageInfo: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    containerEngine: {
      createContainer: vi.fn(),
      logsContainer: vi.fn(),
      deleteContainer: vi.fn(),
      inspectContainer: vi.fn(),
    },
    env: {
      isWindows: false,
    },
  };
});

vi.mock('fast-xml-parser', () => ({
  XMLParser: vi.fn(),
}));

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);

  vi.mocked(getProviderContainerConnection).mockReturnValue({
    providerId: 'dummyProviderId',
    connection: {} as unknown as ContainerProviderConnection,
  });
  vi.mocked(getImageInfo).mockResolvedValue({
    engineId: 'dummyEngineId',
    Id: 'dummyImageId',
  } as unknown as ImageInfo);

  vi.mocked(containerEngine.createContainer).mockResolvedValue({
    id: 'dummyContainerId',
  });

  vi.mocked(containerEngine.logsContainer).mockImplementation(async (_engineId, _containerId, callback) => {
    callback('', '</nvidia_smi_log>');
  });

  vi.mocked(XMLParser).mockReturnValue({
    parse: vi.fn().mockReturnValue({
      nvidia_smi_log: {
        attached_gpus: 1,
        cuda_version: 2,
        driver_version: 3,
        timestamp: 4,
        gpu: {
          uuid: 'dummyUUID',
          product_name: 'dummyProductName',
        },
      },
    }),
  } as unknown as XMLParser);

  vi.mocked(containerEngine.inspectContainer).mockImplementation(async (_engineId, _id) => {
    return {
      State: {
        Running: false,
        ExitCode: 0,
      },
    } as unknown as ContainerInspectInfo;
  });
});

test('post constructor should have no items', () => {
  const manager = new GPUManager(webviewMock);
  expect(manager.getAll().length).toBe(0);
});

test('non-windows host should throw error', async () => {
  vi.mocked(env).isWindows = false;

  const manager = new GPUManager(webviewMock);
  await expect(() => {
    return manager.collectGPUs();
  }).rejects.toThrowError('Cannot collect GPUs information on this machine.');
});

test('windows host should start then delete container with proper configuration', async () => {
  vi.mocked(env).isWindows = true;

  const manager = new GPUManager(webviewMock);
  const gpus = await manager.collectGPUs({
    providerId: 'dummyProviderId',
  });

  expect(gpus.length).toBe(1);
  expect(gpus[0].uuid).toBe('dummyUUID');
  expect(gpus[0].product_name).toBe('dummyProductName');

  expect(getProviderContainerConnection).toHaveBeenCalledWith('dummyProviderId');

  expect(containerEngine.createContainer).toHaveBeenCalledWith('dummyEngineId', {
    Image: 'dummyImageId',
    Cmd: expect.anything(),
    Detach: false,
    Entrypoint: '/usr/bin/sh',
    HostConfig: expect.anything(),
  });
  expect(containerEngine.deleteContainer).toHaveBeenCalledWith('dummyEngineId', 'dummyContainerId');
});
