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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';
import LocalServer from './LocalServer.svelte';
import { writable, type Writable } from 'svelte/store';
import type { ExtensionConfiguration } from '@shared/src/models/IExtensionConfiguration';
import { configuration } from '/@/stores/extensionConfiguration';
import { userEvent } from '@testing-library/user-event';
import { studioClient } from '/@/utils/client';

const updateExtensionConfigurationMock = vi.fn();

vi.mock('/@/stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('/@/utils/client', () => ({
  studioClient: {
    updateExtensionConfiguration: vi.fn(),
    telemetryLogUsage: vi.fn(),
  },
}));

const mockConfiguration: Writable<ExtensionConfiguration> = writable({
  experimentalGPU: false,
  modelsPath: '',
  apiPort: 10434,
  modelUploadDisabled: false,
  experimentalTuning: false,
  showGPUPromotion: false,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.updateExtensionConfiguration).mockImplementation(updateExtensionConfigurationMock);
  vi.mocked(configuration).subscribe.mockImplementation(run => mockConfiguration.subscribe(run));
});

test('port input should update on user input', async () => {
  render(LocalServer);

  const portInput: HTMLInputElement = screen.getByRole('textbox');
  expect(portInput).toBeDefined();

  await userEvent.clear(portInput);
  await userEvent.type(portInput, '8888');

  await vi.waitFor(() => {
    expect(portInput.value).toBe('8888');
  });
});

test('should show default port', async () => {
  render(LocalServer);
  const portInput: HTMLInputElement = screen.getByRole('textbox');

  expect(portInput).toBeDefined();

  await userEvent.clear(portInput);
  // valid port should be >= 0 and <= 65535
  await userEvent.type(portInput, '123456789');
  await new Promise(resolve => setTimeout(resolve, 11));

  await vi.waitFor(() => expect(updateExtensionConfigurationMock).toBeCalled());
});
