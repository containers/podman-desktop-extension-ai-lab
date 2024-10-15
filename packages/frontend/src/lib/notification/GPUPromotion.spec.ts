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
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { studioClient } from '/@/utils/client';
import type { ExtensionConfiguration } from '@shared/src/models/IExtensionConfiguration';
import GPUPromotion from '/@/lib/notification/GPUPromotion.svelte';
import { type Writable, writable } from 'svelte/store';
import { configuration } from '/@/stores/extensionConfiguration';

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      updateExtensionConfiguration: vi.fn(),
      telemetryLogUsage: vi.fn(),
    },
  };
});

vi.mock('../../stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

const mockConfiguration: Writable<ExtensionConfiguration> = writable({
  experimentalGPU: false,
  modelsPath: '',
  apiPort: -1,
  modelUploadDisabled: false,
  experimentalTuning: false,
  showGPUPromotion: false,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.updateExtensionConfiguration).mockResolvedValue(undefined);
  vi.mocked(studioClient.telemetryLogUsage).mockResolvedValue(undefined);
  vi.mocked(configuration).subscribe.mockImplementation(run => mockConfiguration.subscribe(run));
});

test('should show banner if gpu support if off and gpu promotion on', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
  });
  render(GPUPromotion);

  const btnUpdate = screen.queryByRole('button', { name: 'Enable GPU support' });
  expect(btnUpdate).toBeInTheDocument();

  // eslint-disable-next-line quotes
  const btnHide = screen.queryByRole('button', { name: "Don't display anymore" });
  expect(btnHide).toBeInTheDocument();
  expect(studioClient.telemetryLogUsage).toHaveBeenCalledWith('gpuPromotionBanner', { action: 'show' });
});

test('should not show banner if gpu support if on and gpu promotion on', async () => {
  mockConfiguration.set({
    experimentalGPU: true,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
  });
  render(GPUPromotion);

  const btnUpdate = screen.queryByRole('button', { name: 'Enable GPU support' });
  expect(btnUpdate).not.toBeInTheDocument();

  // eslint-disable-next-line quotes
  const btnHide = screen.queryByRole('button', { name: "Don't display anymore" });
  expect(btnHide).not.toBeInTheDocument();
  expect(studioClient.telemetryLogUsage).not.toHaveBeenCalled();
});

test('should not show banner if gpu support if off and gpu promotion off', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: false,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
  });
  render(GPUPromotion);

  // eslint-disable-next-line quotes
  const btnUpdate = screen.queryByRole('button', { name: 'Enable GPU support' });
  expect(btnUpdate).not.toBeInTheDocument();

  // eslint-disable-next-line quotes
  const btnHide = screen.queryByRole('button', { name: "Don't display anymore" });
  expect(btnHide).not.toBeInTheDocument();
  expect(studioClient.telemetryLogUsage).not.toHaveBeenCalled();
});

test('click enable should call client', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
  });
  render(GPUPromotion);

  // eslint-disable-next-line quotes
  const btnUpdate = screen.queryByRole('button', { name: 'Enable GPU support' });
  expect(btnUpdate).toBeInTheDocument();

  // eslint-disable-next-line quotes
  const btnHide = screen.queryByRole('button', { name: "Don't display anymore" });
  expect(btnHide).toBeInTheDocument();

  await fireEvent.click(btnUpdate!);

  expect(studioClient.updateExtensionConfiguration).toHaveBeenCalledWith({ experimentalGPU: true });
  expect(studioClient.telemetryLogUsage).toHaveBeenNthCalledWith(1, 'gpuPromotionBanner', { action: 'show' });
  expect(studioClient.telemetryLogUsage).toHaveBeenNthCalledWith(2, 'gpuPromotionBanner', { action: 'enable' });
});

test('click hide should call client', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
  });
  render(GPUPromotion);

  // eslint-disable-next-line quotes
  const btnUpdate = screen.queryByRole('button', { name: 'Enable GPU support' });
  expect(btnUpdate).toBeInTheDocument();

  // eslint-disable-next-line quotes
  const btnHide = screen.queryByRole('button', { name: "Don't display anymore" });
  expect(btnHide).toBeInTheDocument();

  await fireEvent.click(btnHide!);

  expect(studioClient.updateExtensionConfiguration).toHaveBeenCalledWith({ showGPUPromotion: false });
  expect(studioClient.telemetryLogUsage).toHaveBeenNthCalledWith(1, 'gpuPromotionBanner', { action: 'show' });
  expect(studioClient.telemetryLogUsage).toHaveBeenNthCalledWith(2, 'gpuPromotionBanner', { action: 'hide' });
});
