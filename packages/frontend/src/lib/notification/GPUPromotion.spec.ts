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
import { render, screen } from '@testing-library/svelte';
import { studioClient } from '/@/utils/client';
import type { ExtensionConfiguration } from '@shared/src/models/IExtensionConfiguration';
import GPUPromotion from '/@/lib/notification/GPUPromotion.svelte';

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      navigateToResources: vi.fn(),
    },
  };
});

const mocks = vi.hoisted(() => {
  return {
    getConfigurationMock: vi.fn<() => ExtensionConfiguration>(),
  };
});

vi.mock('../../stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: (f: (msg: ExtensionConfiguration) => void) => {
      f(mocks.getConfigurationMock());
      return (): void => {};
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.navigateToResources).mockResolvedValue(undefined);
});

test('should show banner if gpu support if off and gpu promotion on', async () => {
  mocks.getConfigurationMock.mockReturnValue({
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
  const btnHide = screen.queryByRole('checkbox', { name: "Don't display anymore" });
  expect(btnHide).toBeInTheDocument();
});

test('should not show banner if gpu support if on and gpu promotion on', async () => {
  mocks.getConfigurationMock.mockReturnValue({
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
  const btnHide = screen.queryByRole('checkbox', { name: "Don't display anymore" });
  expect(btnHide).not.toBeInTheDocument();
});

test('should not show banner if gpu support if off and gpu promotion off', async () => {
  mocks.getConfigurationMock.mockReturnValue({
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
  const btnHide = screen.queryByRole('checkbox', { name: "Don't display anymore" });
  expect(btnHide).not.toBeInTheDocument();
});
