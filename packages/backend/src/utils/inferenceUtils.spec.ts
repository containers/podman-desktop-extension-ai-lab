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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getInferenceType, isTransitioning, parseInferenceType, withDefaultConfiguration } from './inferenceUtils';
import { getFreeRandomPort } from './ports';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { InferenceServerInfo, InferenceServerStatus, InferenceType, RuntimeType } from '@shared/src/models/IInference';

vi.mock('./ports', () => ({
  getFreeRandomPort: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getFreeRandomPort).mockResolvedValue(8888);
});

describe('withDefaultConfiguration', () => {
  test('zero modelsInfo', async () => {
    await expect(withDefaultConfiguration({ modelsInfo: [], runtime: RuntimeType.PODMAN })).rejects.toThrowError(
      'modelsInfo need to contain at least one element.',
    );
  });

  test('expect all default values', async () => {
    const result = await withDefaultConfiguration({ modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo], runtime: RuntimeType.PODMAN });

    expect(getFreeRandomPort).toHaveBeenCalledWith('0.0.0.0');

    expect(result.port).toBe(8888);
    expect(result.image).toBe(undefined);
    expect(result.labels).toStrictEqual({});
    expect(result.providerId).toBe(undefined);
  });

  test('expect no default values', async () => {
    const result = await withDefaultConfiguration({
      modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo],
      port: 9999,
      providerId: 'dummyProviderId',
      image: 'random-image',
      labels: { hello: 'world' },
      runtime: RuntimeType.PODMAN,
    });

    expect(getFreeRandomPort).not.toHaveBeenCalled();

    expect(result.port).toBe(9999);
    expect(result.image).toBe('random-image');
    expect(result.labels).toStrictEqual({ hello: 'world' });
    expect(result.providerId).toBe('dummyProviderId');
  });
});

test.each(['stopping', 'deleting', 'starting'] as InferenceServerStatus[])(
  '%s should be a transitioning state',
  status => {
    expect(
      isTransitioning({
        status: status,
      } as unknown as InferenceServerInfo),
    ).toBeTruthy();
  },
);

test.each(['running', 'stopped', 'error'] as InferenceServerStatus[])('%s should be a stable state', status => {
  expect(
    isTransitioning({
      status: status,
    } as unknown as InferenceServerInfo),
  ).toBeFalsy();
});

describe('parseInferenceType', () => {
  test('undefined argument should return InferenceType.None', () => {
    expect(parseInferenceType(undefined)).toBe(InferenceType.NONE);
  });

  test('llama-cpp should return the proper InferenceType.LLAMA_CPP', () => {
    expect(parseInferenceType('llama-cpp')).toBe(InferenceType.LLAMA_CPP);
  });
});

describe('getInferenceType', () => {
  test('empty array should return InferenceType.None', () => {
    expect(getInferenceType([])).toBe(InferenceType.NONE);
  });

  test('single model with undefined backend should return InferenceType.None', () => {
    expect(
      getInferenceType([
        {
          backend: undefined,
        } as unknown as ModelInfo,
      ]),
    ).toBe(InferenceType.NONE);
  });

  test('single model with llamacpp backend should return InferenceType.LLAMA_CPP', () => {
    expect(
      getInferenceType([
        {
          backend: 'llama-cpp',
        } as unknown as ModelInfo,
      ]),
    ).toBe(InferenceType.LLAMA_CPP);
  });

  test('multiple model with llamacpp backend should return InferenceType.LLAMA_CPP', () => {
    expect(
      getInferenceType([
        {
          backend: 'llama-cpp',
        },
        {
          backend: 'llama-cpp',
        },
      ] as unknown as ModelInfo[]),
    ).toBe(InferenceType.LLAMA_CPP);
  });

  test('multiple model with different backend should return InferenceType.None', () => {
    expect(
      getInferenceType([
        {
          backend: 'llama-cpp',
        },
        {
          backend: 'whisper-cpp',
        },
      ] as unknown as ModelInfo[]),
    ).toBe(InferenceType.NONE);
  });
});
