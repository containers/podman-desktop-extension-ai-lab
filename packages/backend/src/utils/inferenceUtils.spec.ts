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
import { generateContainerCreateOptions } from './inferenceUtils';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { ImageInfo } from '@podman-desktop/api';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('generateContainerCreateOptions', () => {
  test('valid arguments', () => {
    const result = generateContainerCreateOptions(
      {
        port: 8888,
        providerId: 'test@providerId',
        image: 'quay.io/bootsy/playground:v0',
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
        RepoTags: ['quay.io/bootsy/playground:v0'],
      } as unknown as ImageInfo,
    );
    expect(result).toStrictEqual({
      Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
      Detach: true,
      Env: ['MODEL_PATH=/models/dummyFile'],
      ExposedPorts: {
        '8888': {},
      },
      HealthCheck: {
        Interval: 15000000000,
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
        'ai-studio-inference-server': '["dummyModelId"]',
      },
    });
  });
});
