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
import { vi, test, expect, describe, beforeEach } from 'vitest';
import { withDefaultConfiguration, isTransitioning, parseInferenceType, getInferenceType } from './inferenceUtils';
import { getFreeRandomPort } from './ports';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { InferenceServer, InferenceServerStatus } from '@shared/models/IInference';
import { InferenceType } from '@shared/models/IInference';
import type { ContainerProviderConnectionInfo } from '@shared/models/IContainerConnectionInfo';

vi.mock('./ports', () => ({
  getFreeRandomPort: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getFreeRandomPort).mockResolvedValue(8888);
});

describe('withDefaultConfiguration', () => {
  test('zero modelsInfo', async () => {
    await expect(withDefaultConfiguration({ modelsInfo: [] })).rejects.toThrowError(
      'modelsInfo need to contain at least one element.',
    );
  });

  test('expect all default values', async () => {
    const result = await withDefaultConfiguration({ modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo] });

    expect(getFreeRandomPort).toHaveBeenCalledWith('0.0.0.0');

    expect(result.port).toBe(8888);
    expect(result.image).toBeUndefined();
    expect(result.labels).toStrictEqual({});
    expect(result.connection).toBeUndefined();
    expect(result.ctxSize).toBeUndefined();
  });

  test('ctxSize should be passed through', async () => {
    const result = await withDefaultConfiguration({
      modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo],
      ctxSize: 32768,
    });

    expect(result.ctxSize).toBe(32768);
  });

  test.each([512, 131072])('ctxSize %d on the boundaries should be accepted', async ctxSize => {
    const result = await withDefaultConfiguration({
      modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo],
      ctxSize,
    });

    expect(result.ctxSize).toBe(ctxSize);
  });

  test.each([0, -1, 511, 131073, 4096.5, Number.NaN])('ctxSize %d should be rejected', async ctxSize => {
    await expect(
      withDefaultConfiguration({
        modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo],
        ctxSize,
      }),
    ).rejects.toThrowError('ctxSize must be an integer between 512 and 131072.');
  });

  describe('model maximum context size', () => {
    const model = { id: 'dummyId', maxCtxSize: 32768 } as unknown as ModelInfo;

    test('ctxSize up to the model maximum should be accepted', async () => {
      const result = await withDefaultConfiguration({ modelsInfo: [model], ctxSize: 32768 });
      expect(result.ctxSize).toBe(32768);
    });

    test('ctxSize above the model maximum should be rejected, even below the global limit', async () => {
      await expect(withDefaultConfiguration({ modelsInfo: [model], ctxSize: 32769 })).rejects.toThrowError(
        'ctxSize must be an integer between 512 and 32768.',
      );
    });

    test('a model maximum above the global limit should be honoured', async () => {
      const big = { id: 'dummyId', maxCtxSize: 1048576 } as unknown as ModelInfo;
      const result = await withDefaultConfiguration({ modelsInfo: [big], ctxSize: 262144 });
      expect(result.ctxSize).toBe(262144);
    });
  });

  test('expect no default values', async () => {
    const connectionMock = {
      name: 'Dummy Connection',
    } as unknown as ContainerProviderConnectionInfo;
    const result = await withDefaultConfiguration({
      modelsInfo: [{ id: 'dummyId' } as unknown as ModelInfo],
      port: 9999,
      connection: connectionMock,
      image: 'random-image',
      labels: { hello: 'world' },
    });

    expect(getFreeRandomPort).not.toHaveBeenCalled();

    expect(result.port).toBe(9999);
    expect(result.image).toBe('random-image');
    expect(result.labels).toStrictEqual({ hello: 'world' });
    expect(result.connection).toBe(connectionMock);
  });
});

test.each(['stopping', 'deleting', 'starting'] as InferenceServerStatus[])(
  '%s should be a transitioning state',
  status => {
    expect(
      isTransitioning({
        status: status,
      } as unknown as InferenceServer),
    ).toBeTruthy();
  },
);

test.each(['running', 'stopped', 'error'] as InferenceServerStatus[])('%s should be a stable state', status => {
  expect(
    isTransitioning({
      status: status,
    } as unknown as InferenceServer),
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
