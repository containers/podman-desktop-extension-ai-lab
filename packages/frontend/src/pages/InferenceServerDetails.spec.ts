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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { type InferenceServer, InferenceType } from '@shared/src/models/IInference';
import InferenceServerDetails from '/@/pages/InferenceServerDetails.svelte';
import type { Language } from 'postman-code-generators';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

const mocks = vi.hoisted(() => {
  return {
    getInferenceServersMock: vi.fn<() => InferenceServer[]>(),
    getSnippetLanguagesMock: vi.fn(),
  };
});

vi.mock('../stores/inferenceServers', () => ({
  inferenceServers: {
    subscribe: (f: (msg: InferenceServer[]) => void) => {
      f(mocks.getInferenceServersMock());
      return () => {};
    },
  },
}));

vi.mock('../stores/snippetLanguages', () => ({
  snippetLanguages: {
    subscribe: (f: (msg: any) => void) => {
      f(mocks.getSnippetLanguagesMock());
      return () => {};
    },
  },
}));

vi.mock('../utils/client', () => {
  return {
    studioClient: {
      openURL: vi.fn(),
      createSnippet: vi.fn(),
      copyToClipboard: vi.fn(),
      telemetryLogUsage: vi.fn(),
    },
  };
});

const inferenceServerMock: InferenceServer = {
  health: {
    Status: 'healthy',
    Log: [],
    FailingStreak: 0,
  },
  models: [
    {
      id: 'dummyModelId',
      name: 'Dummy model id',
    } as unknown as ModelInfo,
  ],
  connection: { port: 9999 },
  status: 'running',
  container: {
    containerId: 'dummyContainerId',
    engineId: 'dummyEngineId',
  },
  type: InferenceType.NONE,
  labels: {},
};

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(studioClient.copyToClipboard).mockResolvedValue(undefined);
  vi.mocked(studioClient.telemetryLogUsage).mockResolvedValue(undefined);

  mocks.getSnippetLanguagesMock.mockReturnValue([
    {
      key: 'dummyLanguageKey',
      label: 'dummyLanguageLabel',
      syntax_mode: 'dummySynthaxMode',
      variants: [
        {
          key: 'dummyLanguageVariant1',
        },
        {
          key: 'dummyLanguageVariant2',
        },
      ],
    },
    {
      key: 'curl',
      label: 'cURL',
      syntax_mode: '?',
      variants: [
        {
          key: 'cURL',
        },
      ],
    },
  ] as Language[]);

  mocks.getInferenceServersMock.mockReturnValue([inferenceServerMock]);
});

test('ensure documentation url is displayed', async () => {
  mocks.getInferenceServersMock.mockReturnValue([
    {
      ...inferenceServerMock,
      labels: {
        docs: 'http://localhost:9999/docs',
      },
    },
  ]);
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const address = screen.getByText('http://localhost:9999/docs');
  expect(address).toBeDefined();

  await fireEvent.click(address);

  expect(studioClient.openURL).toHaveBeenCalledWith('http://localhost:9999/docs');
});

test('ensure api url is displayed', async () => {
  mocks.getInferenceServersMock.mockReturnValue([
    {
      ...inferenceServerMock,
      labels: {
        api: 'http://localhost:9999/v1',
      },
    },
  ]);
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const address = screen.getByText('http://localhost:9999/v1');
  expect(address).toBeDefined();

  await fireEvent.click(address);

  expect(studioClient.openURL).toHaveBeenCalledWith('http://localhost:9999/v1');
});

test('language select must have the mocked snippet languages', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const select: HTMLSelectElement = screen.getByLabelText('snippet language selection');
  expect(select).toBeDefined();
  expect(select.options.length).toBe(2);
  expect(select.options[0].value).toBe('dummyLanguageKey');
});

test('default render should show curl', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const variantSelect: HTMLSelectElement = screen.getByLabelText('snippet language variant');
  expect(variantSelect.value).toBe('cURL');
});

test('on mount should call createSnippet', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  expect(studioClient.createSnippet).toHaveBeenCalledWith(
    {
      body: expect.anything(),
      header: expect.anything(),
      url: 'http://localhost:9999/v1/chat/completions',
      method: 'POST',
    },
    'curl',
    'cURL',
  );
});

test('invalid container id should redirect to services page', async () => {
  const gotoSpy = vi.spyOn(router, 'goto');
  render(InferenceServerDetails, {
    containerId: 'fakeContainerId',
  });

  expect(gotoSpy).toHaveBeenCalledWith('/services');
});

test('copy snippet should call copyToClipboard', async () => {
  vi.mocked(studioClient.createSnippet).mockResolvedValue('dummy generated snippet');
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  await vi.waitFor(() => {
    const copyBtn = screen.getByTitle('Copy');
    expect(copyBtn).toBeDefined();
    fireEvent.click(copyBtn);
  });

  await vi.waitFor(() => {
    expect(studioClient.copyToClipboard).toHaveBeenCalledWith('dummy generated snippet');
  });
});

test('ensure dummyContainerId is visible', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const span = screen.getByText('dummyContainerId');
  expect(span).toBeDefined();
});

test('ensure models to be clickable', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const a = screen.getByText('Dummy model id');
  expect(a).toBeDefined();
  expect(a.getAttribute('href')).toBe('/model/dummyModelId');
});

describe('labels', () => {
  test('GPU label should display GPU Inference', async () => {
    mocks.getInferenceServersMock.mockReturnValue([
      {
        ...inferenceServerMock,
        labels: {
          gpu: 'NVIDIA',
        },
      },
    ]);
    render(InferenceServerDetails, {
      containerId: 'dummyContainerId',
    });

    const span = screen.getByText('GPU Inference');
    expect(span).toBeDefined();
  });

  test('no label should display CPU Inference', async () => {
    render(InferenceServerDetails, {
      containerId: 'dummyContainerId',
    });

    const span = screen.getByText('CPU Inference');
    expect(span).toBeDefined();
  });
});
