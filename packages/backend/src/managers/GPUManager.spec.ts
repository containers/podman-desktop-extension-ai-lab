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
import type { Webview } from '@podman-desktop/api';
import { GPUManager } from './GPUManager';
import { graphics, type Systeminformation } from 'systeminformation';
import { GPUVendor } from '@shared/src/models/IGPUInfo';

vi.mock('../utils/inferenceUtils', () => ({
  getProviderContainerConnection: vi.fn(),
  getImageInfo: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      isWindows: false,
    },
  };
});

vi.mock('systeminformation', () => ({
  graphics: vi.fn(),
}));

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(webviewMock.postMessage).mockResolvedValue(true);
});

test('post constructor should have no items', () => {
  const manager = new GPUManager(webviewMock);
  expect(manager.getAll().length).toBe(0);
});

test('no controller should return empty array', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [],
    displays: [],
  });

  const manager = new GPUManager(webviewMock);
  expect(await manager.collectGPUs()).toHaveLength(0);
});

test('intel controller should return intel vendor', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [{
      vendor: 'Intel Corporation',
      model: 'intel model',
      vram: 1024,
    } as unknown as Systeminformation.GraphicsControllerData],
    displays: [],
  });

  const manager = new GPUManager(webviewMock);
  expect(await manager.collectGPUs()).toStrictEqual([{
    vendor: GPUVendor.INTEL,
    model: 'intel model',
    vram: 1024,
  }]);
});

test('NVIDIA controller should return intel vendor', async () => {
  vi.mocked(graphics).mockResolvedValue({
    controllers: [{
      vendor: 'NVIDIA',
      model: 'NVIDIA GeForce GTX 1060 6GB',
      vram: 6144,
    } as unknown as Systeminformation.GraphicsControllerData],
    displays: [],
  });

  const manager = new GPUManager(webviewMock);
  expect(await manager.collectGPUs()).toStrictEqual([{
    vendor: GPUVendor.NVIDIA,
    model: 'NVIDIA GeForce GTX 1060 6GB',
    vram: 6144,
  }]);
});
