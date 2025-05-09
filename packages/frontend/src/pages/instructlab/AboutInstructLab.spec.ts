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

import '@testing-library/jest-dom/vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable, type Writable } from 'svelte/store';
import userEvent from '@testing-library/user-event';
import AboutInstructLab from './AboutInstructLab.svelte';
import type { ExtensionConfiguration } from '@shared/models/IExtensionConfiguration';
import { configuration } from '/@/stores/extensionConfiguration';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';

vi.mock('/@/stores/extensionConfiguration', () => ({
  configuration: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('tinro', () => ({
  router: {
    goto: vi.fn(),
  },
}));

vi.mock('/@/utils/client', () => ({
  studioClient: {
    openURL: vi.fn(),
  },
}));

class ResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

const mockConfiguration: Writable<ExtensionConfiguration> = writable({
  experimentalGPU: false,
  modelsPath: '',
  apiPort: -1,
  modelUploadDisabled: false,
  experimentalTuning: false,
  showGPUPromotion: false,
  appearance: 'dark',
});

beforeEach(() => {
  Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserver });
  vi.resetAllMocks();
  vi.mocked(configuration).subscribe.mockImplementation(run => mockConfiguration.subscribe(run));
});

test('renders Start Fine Tuning button if experimentalTuning is true', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: true,
    apiPort: -1,
    appearance: 'dark',
  });
  render(AboutInstructLab);
  expect(await screen.findByText('Start Fine Tuning')).toBeInTheDocument();
});

test('does not render Start Fine Tuning button if experimentalTuning is false', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: false,
    apiPort: -1,
    appearance: 'dark',
  });
  render(AboutInstructLab);
  expect(screen.queryByText('Start Fine Tuning')).not.toBeInTheDocument();
});

test('navigates to /tune/start when Start Fine Tuning is clicked', async () => {
  mockConfiguration.set({
    experimentalGPU: false,
    showGPUPromotion: true,
    modelUploadDisabled: false,
    modelsPath: '',
    experimentalTuning: true,
    apiPort: -1,
    appearance: 'dark',
  });
  render(AboutInstructLab);
  const btn = await screen.findByText('Start Fine Tuning');
  await userEvent.click(btn);
  expect(router.goto).toHaveBeenCalledWith('/tune/start');
});

test('opens documentation link when clicked', async () => {
  render(AboutInstructLab);
  const docLink = await screen.findByText('Access InstructLab documentation');
  await userEvent.click(docLink);
  expect(studioClient.openURL).toHaveBeenCalledWith('https://docs.instructlab.ai/');
});

test('opens HuggingFace link when clicked', async () => {
  render(AboutInstructLab);
  const hfLink = await screen.findByText('View InstructLab on HuggingFace');
  await userEvent.click(hfLink);
  expect(studioClient.openURL).toHaveBeenCalledWith('https://huggingface.co/instructlab');
});
