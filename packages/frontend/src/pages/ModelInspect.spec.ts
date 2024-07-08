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

import { vi, test, expect, beforeEach } from 'vitest';
import { render, within } from '@testing-library/svelte';
import ModelInspect from '/@/pages/ModelInspect.svelte';
import { studioClient } from '/@/utils/client';

const mocks = vi.hoisted(() => ({
  getModelsMetataStoreContent: vi.fn(),
  modelsMetadataStoreMock: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.getModelsMetataStoreContent());
      return () => {};
    },
  },
}));

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      getModelMetadata: vi.fn(),
    },
  };
});

vi.mock('../stores/modelsMetadata', async () => {
  return {
    modelsMetadata: mocks.modelsMetadataStoreMock,
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

test('empty store should fetch metadata', async () => {
  mocks.getModelsMetataStoreContent.mockReturnValue({});
  vi.mocked(studioClient.getModelMetadata).mockResolvedValue({});

  render(ModelInspect, {
    modelId: 'dummy-model-id',
  });

  await vi.waitFor(() => {
    expect(studioClient.getModelMetadata).toHaveBeenCalledWith('dummy-model-id');
  });
});

test('store with existing metadata should use it', async () => {
  mocks.getModelsMetataStoreContent.mockReturnValue({
    'dummy-model-id': {},
  });

  const { container } = render(ModelInspect, {
    modelId: 'dummy-model-id',
  });

  await vi.waitFor(() => {
    expect(within(container).queryByRole('progressbar')).toBeNull();
  });

  expect(studioClient.getModelMetadata).not.toHaveBeenCalled();
});

test('api error should be displayed', async () => {
  mocks.getModelsMetataStoreContent.mockReturnValue({});

  vi.mocked(studioClient.getModelMetadata).mockRejectedValue(new Error('dummy test error'));
  const { container } = render(ModelInspect, {
    modelId: 'dummy-model-id',
  });

  await vi.waitFor(() => {
    expect(within(container).getByRole('alert').textContent).toBe(
      'Something went wrong while fetching model metadata: Error: dummy test error',
    );
  });
});
