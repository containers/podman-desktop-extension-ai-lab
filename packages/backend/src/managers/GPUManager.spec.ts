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
import { env } from '@podman-desktop/api';
import type { Webview } from '@podman-desktop/api';
import { GPUManager } from './GPUManager';

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

vi.mock('fast-xml-parser', () => ({
  XMLParser: vi.fn(),
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

test('non-windows host should throw error', async () => {
  vi.mocked(env).isWindows = false;

  const manager = new GPUManager(webviewMock);
  await expect(() => {
    return manager.collectGPUs();
  }).rejects.toThrowError();
});
