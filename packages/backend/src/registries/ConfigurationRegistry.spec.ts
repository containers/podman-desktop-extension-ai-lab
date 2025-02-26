/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import { vi, expect, test } from 'vitest';
import { configuration, type Configuration } from '@podman-desktop/api';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import type { RpcExtension } from '@shared/src/messages/MessageProxy';

const fakeConfiguration = {
  get: vi.fn(),
  has: vi.fn(),
  update: vi.fn(),
} as unknown as Configuration;

const rpcExtensionMock = {
  fire: vi.fn().mockResolvedValue(true),
} as unknown as RpcExtension;

vi.mock('@podman-desktop/api', async () => {
  return {
    configuration: {
      getConfiguration: (): unknown => fakeConfiguration,
      onDidChangeConfiguration: vi.fn(),
    },
  };
});

test('init should init listener', () => {
  const registry = new ConfigurationRegistry(rpcExtensionMock, 'appdir');
  vi.mocked(fakeConfiguration.has).mockReturnValue(true);

  registry.init();
  expect(configuration.onDidChangeConfiguration).toHaveBeenCalled();
});

test('dispose should dispose listener', () => {
  const registry = new ConfigurationRegistry(rpcExtensionMock, 'appdir');
  vi.mocked(fakeConfiguration.has).mockReturnValue(true);

  const disposeMock = vi.fn();
  vi.mocked(configuration.onDidChangeConfiguration).mockReturnValue({ dispose: disposeMock });

  registry.init();
  expect(configuration.onDidChangeConfiguration).toHaveBeenCalled();

  registry.dispose();
  expect(disposeMock).toHaveBeenCalled();
});

test('update should trigger configuration update', async () => {
  const registry = new ConfigurationRegistry(rpcExtensionMock, 'appdir');
  vi.mocked(fakeConfiguration.has).mockReturnValue(true);
  vi.mocked(fakeConfiguration.update).mockResolvedValue(undefined);

  registry.init();
  await registry.updateExtensionConfiguration({ modelsPath: '' });
  expect(fakeConfiguration.update).toHaveBeenCalledWith('models.path', '');
});
