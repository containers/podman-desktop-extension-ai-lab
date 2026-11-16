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
import {
  withDefaultConfiguration,
  isTransitioning,
  parseInferenceType,
  getInferenceType,
  getInferenceTypes,
  getModelInferenceTypes,
} from './inferenceUtils';
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
          backends: undefined,
        } as unknown as ModelInfo,
      ]),
    ).toBe(InferenceType.NONE);
  });

  test('single model with llamacpp backend should return InferenceType.LLAMA_CPP', () => {
    expect(
      getInferenceType([
        {
          backends: ['llama-cpp'],
        } as unknown as ModelInfo,
      ]),
    ).toBe(InferenceType.LLAMA_CPP);
  });

  test('multiple model with llamacpp backend should return InferenceType.LLAMA_CPP', () => {
    expect(
      getInferenceType([
        {
          backends: ['llama-cpp'],
        },
        {
          backends: ['llama-cpp'],
        },
      ] as unknown as ModelInfo[]),
    ).toBe(InferenceType.LLAMA_CPP);
  });

  test('multiple model with different backend should return InferenceType.None', () => {
    expect(
      getInferenceType([
        {
          backends: ['llama-cpp'],
        },
        {
          backends: ['whisper-cpp'],
        },
      ] as unknown as ModelInfo[]),
    ).toBe(InferenceType.NONE);
  });

  test('multiple models with several backends should return the preferred common backend', () => {
    expect(
      getInferenceType([
        {
          backends: ['openvino', 'llama-cpp'],
        },
        {
          backends: ['llama-cpp', 'openvino'],
        },
      ] as unknown as ModelInfo[]),
    ).toBe(InferenceType.OPENVINO);
  });
});

describe('getModelInferenceTypes', () => {
  test('model without backend should return InferenceType.NONE', () => {
    expect(getModelInferenceTypes({} as unknown as ModelInfo)).toStrictEqual([InferenceType.NONE]);
  });

  test('model with several backends should return them in order', () => {
    expect(getModelInferenceTypes({ backends: ['openvino', 'llama-cpp'] } as unknown as ModelInfo)).toStrictEqual([
      InferenceType.OPENVINO,
      InferenceType.LLAMA_CPP,
    ]);
  });
});

describe('getInferenceTypes', () => {
  test('empty array should return an empty array', () => {
    expect(getInferenceTypes([])).toStrictEqual([]);
  });

  test('should return the backends in the order of the first model', () => {
    expect(
      getInferenceTypes([
        { backends: ['openvino', 'llama-cpp'] },
        { backends: ['llama-cpp', 'openvino'] },
      ] as unknown as ModelInfo[]),
    ).toStrictEqual([InferenceType.OPENVINO, InferenceType.LLAMA_CPP]);
  });

  test('should return the backends common to all the models', () => {
    expect(
      getInferenceTypes([
        { backends: ['openvino', 'llama-cpp'] },
        { backends: ['llama-cpp', 'openvino'] },
        { backends: ['llama-cpp'] },
      ] as unknown as ModelInfo[]),
    ).toStrictEqual([InferenceType.LLAMA_CPP]);
  });

  test('should return an empty array if the models do not have any backend in common', () => {
    expect(
      getInferenceTypes([{ backends: ['openvino'] }, { backends: ['llama-cpp'] }] as unknown as ModelInfo[]),
    ).toStrictEqual([]);
  });
});
