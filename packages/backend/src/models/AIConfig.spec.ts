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

import { expect, test, describe, vi } from 'vitest';
import fs from 'fs';
import { type AIConfig, parseYamlFile } from './AIConfig';

// Define mock file paths and contents
const mockYamlPath = '/path/to/mock.yml';
const mockYamlContent = `
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      arch: ["x86"]
      model-service: true
      gpu-env: ["env1", "env2"]
      ports: [ 8080 ]
    - name: container2
      arch: ["arm"]
      ports: [ 8001 ]
`;

const readFileSync = vi.spyOn(fs, 'readFileSync');

describe('parseYaml', () => {
  test('should parse valid YAML file', () => {
    readFileSync.mockReturnValue(mockYamlContent);

    const defaultArch = 'x64';
    const expectedConfig: AIConfig = {
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: ['x86'],
            modelService: true,
            gpu_env: ['env1', 'env2'],
            ports: [8080],
          },
          {
            name: 'container2',
            contextdir: '.',
            arch: ['arm'],
            modelService: false,
            gpu_env: [],
            ports: [8001],
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });
});
