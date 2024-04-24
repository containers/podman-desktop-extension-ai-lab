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
  generateContainerCreateOptions,
  withDefaultConfiguration,
  INFERENCE_SERVER_IMAGE,
  SECOND,
  isTransitioning,
} from './inferenceUtils';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { ImageInfo } from '@podman-desktop/api';
import { getFreeRandomPort } from './ports';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { InferenceServer, InferenceServerStatus } from '@shared/src/models/IInference';

vi.mock('./ports', () => ({
  getFreeRandomPort: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getFreeRandomPort).mockResolvedValue(8888);
});

describe('generateContainerCreateOptions', () => {
  test('valid arguments', () => {
    const result = generateContainerCreateOptions(
      {
        port: 8888,
        providerId: 'test@providerId',
        image: INFERENCE_SERVER_IMAGE,
        modelsInfo: [
          {
            id: 'dummyModelId',
            file: {
              file: 'dummyFile',
              path: 'dummyPath',
            },
          },
        ],
      } as unknown as InferenceServerConfig,
      {
        Id: 'dummyImageId',
        engineId: 'dummyEngineId',
        RepoTags: [INFERENCE_SERVER_IMAGE],
      } as unknown as ImageInfo,
    );
    expect(result).toStrictEqual({
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
      Detach: true,
      Env: ['MODEL_PATH=/models/dummyFile', 'HOST=0.0.0.0', 'PORT=8000'],
      ExposedPorts: {
        '8888': {},
      },
      HealthCheck: {
        Interval: SECOND * 5,
        Retries: 20,
        Test: ['CMD-SHELL', 'curl -sSf localhost:8000/docs > /dev/null'],
      },
      HostConfig: {
        AutoRemove: false,
        Mounts: [
          {
            Source: 'dummyPath',
            Target: '/models',
            Type: 'bind',
          },
        ],
        PortBindings: {
          '8000/tcp': [
            {
              HostPort: '8888',
            },
          ],
        },
        SecurityOpt: ['label=disable'],
      },
      Image: 'dummyImageId',
      Labels: {
        'ai-lab-inference-server': '["dummyModelId"]',
      },
    });
  });

  test('model info with chat_format properties', () => {
    const result = generateContainerCreateOptions(
      {
        port: 8888,
        providerId: 'test@providerId',
        image: INFERENCE_SERVER_IMAGE,
        modelsInfo: [
          {
            id: 'dummyModelId',
            file: {
              file: 'dummyFile',
              path: 'dummyPath',
            },
            properties: {
              chatFormat: 'dummyChatFormat',
            },
          },
        ],
      } as unknown as InferenceServerConfig,
      {
        Id: 'dummyImageId',
        engineId: 'dummyEngineId',
        RepoTags: [INFERENCE_SERVER_IMAGE],
      } as unknown as ImageInfo,
    );

    expect(result.Env).toContain('MODEL_CHAT_FORMAT=dummyChatFormat');
  });

  test('model info with multiple properties', () => {
    const result = generateContainerCreateOptions(
      {
        port: 8888,
        providerId: 'test@providerId',
        image: INFERENCE_SERVER_IMAGE,
        modelsInfo: [
          {
            id: 'dummyModelId',
            file: {
              file: 'dummyFile',
              path: 'dummyPath',
            },
            properties: {
              basicProp: 'basicProp',
              lotOfCamelCases: 'lotOfCamelCases',
              lowercase: 'lowercase',
            },
          },
        ],
      } as unknown as InferenceServerConfig,
      {
        Id: 'dummyImageId',
        engineId: 'dummyEngineId',
        RepoTags: [INFERENCE_SERVER_IMAGE],
      } as unknown as ImageInfo,
    );

    expect(result.Env).toContain('MODEL_BASIC_PROP=basicProp');
    expect(result.Env).toContain('MODEL_LOT_OF_CAMEL_CASES=lotOfCamelCases');
    expect(result.Env).toContain('MODEL_LOWERCASE=lowercase');
  });
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
    expect(result.image).toBe(INFERENCE_SERVER_IMAGE);
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
