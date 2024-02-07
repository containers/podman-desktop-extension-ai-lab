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

import * as jsYaml from 'js-yaml';
import fs from 'fs';

export interface ContainerConfig {
  name: string;
  contextdir: string;
  containerfile?: string;
  arch: string[];
  modelService: boolean;
  gpu_env: string[];
}
export interface AIConfig {
  application: {
    containers: ContainerConfig[];
  };
}

export interface AIConfigFile {
  aiConfig: AIConfig;
  path: string;
}

export function isString(value: unknown): value is string {
  return (!!value && typeof value === 'string') || value instanceof String;
}

export function assertString(value: unknown): string {
  if (isString(value)) return value;
  throw new Error('value not a string');
}

export function parseYamlFile(filepath: string, defaultArch: string): AIConfig {
  const raw: string = fs.readFileSync(filepath, 'utf-8');

  const aiStudioConfig = jsYaml.load(raw);
  const application = aiStudioConfig?.['application'];
  if (!application) throw new Error('AIConfig has bad formatting.');

  const containers: unknown[] = application['containers'] ?? [];

  return {
    application: {
      containers: containers.map(container => {
        if (typeof container !== 'object') throw new Error('containers array malformed');

        let contextdir: string;
        if ('contextdir' in container) {
          contextdir = assertString(container['contextdir']);
        } else {
          contextdir = '.';
        }

        return {
          arch: Array.isArray(container['arch']) ? container['arch'] : [defaultArch],
          modelService: container['model-service'] === true,
          containerfile: isString(container['containerfile']) ? container['containerfile'] : undefined,
          contextdir: contextdir,
          name: assertString(container['name']),
          gpu_env: Array.isArray(container['gpu-env']) ? container['gpu-env'] : [],
        };
      }),
    },
  };
}
