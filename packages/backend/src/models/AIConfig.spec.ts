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
import { type AIConfig, AIConfigFormat, parseYamlFile } from './AIConfig';

// Define mock file paths and contents
const mockYamlPath = '/path/to/mock.yml';
const defaultArch = 'x64';

const readFileSync = vi.spyOn(fs, 'readFileSync');

describe('parseYaml', () => {
  test('malformed configuration', () => {
    readFileSync.mockReturnValue(``);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('malformed configuration file.');
  });

  test('missing application property', () => {
    readFileSync.mockReturnValue(`
wrong:
`);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('malformed configuration file: missing version');
  });

  test('version mismatch', () => {
    readFileSync.mockReturnValue(`
version: unknown
application: true
`);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('malformed configuration file: version not supported, got unknown expected v1.0.');
  });

  test('application primitive', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application: true
`);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('AIConfig has bad formatting: application does not have valid container property');
  });

  test('containers not an array', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    name: container1
    contextdir: /path/to/dir1
    arch: ["x86"]
    model-service: true
    gpu-env: ["env1", "env2"]
    ports: [ 8080 ]
`);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('AIConfig has bad formatting: containers property must be an array.');
  });

  test('containers object', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers: true
`);
    expect(() => {
      parseYamlFile(mockYamlPath, defaultArch);
    }).toThrowError('AIConfig has bad formatting: containers property must be an array.');
  });

  test('should use architecture as string', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      arch: x86
      ports: [ 8080 ]
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: ['x86'],
            gpu_env: [],
            modelService: false,
            ports: [8080],
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('should use all architectures', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      arch: ['arch1', 'arch2']
      ports: [ 8080 ]
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: ['arch1', 'arch2'],
            gpu_env: [],
            modelService: false,
            ports: [8080],
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('should put the default architecture', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      ports: [ 8080 ]
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: [defaultArch],
            gpu_env: [],
            modelService: false,
            ports: [8080],
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('should use the image provided in the config', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      ports: [ 8080 ]
      image: dummy-image
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: [defaultArch],
            gpu_env: [],
            modelService: false,
            ports: [8080],
            image: 'dummy-image',
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('ports should always be a final number', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
application:
  containers:
    - name: container1
      contextdir: /path/to/dir1
      ports: [ '8080', 8888 ]
      image: dummy-image
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
      application: {
        containers: [
          {
            name: 'container1',
            contextdir: '/path/to/dir1',
            arch: [defaultArch],
            gpu_env: [],
            modelService: false,
            ports: [8080, 8888],
            image: 'dummy-image',
          },
        ],
      },
    };

    expect(parseYamlFile(mockYamlPath, defaultArch)).toEqual(expectedConfig);
  });

  test('should use gpu env', () => {
    readFileSync.mockReturnValue(`
version: ${AIConfigFormat.CURRENT}
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
`);

    const expectedConfig: AIConfig = {
      version: AIConfigFormat.CURRENT,
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
