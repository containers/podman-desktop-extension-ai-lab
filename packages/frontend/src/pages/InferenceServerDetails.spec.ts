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
import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import type { InferenceServer } from '@shared/src/models/IInference';
import InferenceServerDetails from '/@/pages/InferenceServerDetails.svelte';
import type { Language } from 'postman-code-generators';
import { studioClient } from '/@/utils/client';

const mocks = vi.hoisted(() => {
  return {
    getInferenceServersMock: vi.fn(),
    getSnippetLanguagesMock: vi.fn(),
  };
});

vi.mock('../stores/inferenceServers', () => ({
  inferenceServers: {
    subscribe: (f: (msg: any) => void) => {
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
      createSnippet: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();

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

  mocks.getInferenceServersMock.mockReturnValue([
    {
      health: {
        Status: 'healthy',
        Log: [],
        FailingStreak: 0,
      },
      models: [],
      connection: { port: 9999 },
      status: 'running',
      container: {
        containerId: 'dummyContainerId',
        engineId: 'dummyEngineId',
      },
    } as InferenceServer,
  ]);
});

test('ensure address is displayed', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const address = screen.getByText('http://localhost:9999/v1');
  expect(address).toBeDefined();
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

  expect(studioClient.createSnippet).toHaveBeenCalled();
});

test('ensure status is visible when running', async () => {
  render(InferenceServerDetails, {
    containerId: 'dummyContainerId',
  });

  const status = screen.getByRole('status');
  expect(status).toBeDefined();
});
