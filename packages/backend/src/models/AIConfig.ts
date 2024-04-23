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
  ports?: number[];
  image?: string;
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

  const aiLabConfig: unknown = jsYaml.load(raw);
  if (!aiLabConfig || typeof aiLabConfig !== 'object') {
    throw new Error('malformed configuration file.');
  }

  if (!('application' in aiLabConfig)) {
    throw new Error('AIConfig has bad formatting: missing application property');
  }

  const application: unknown = aiLabConfig['application'];
  if (!application || typeof application !== 'object' || !('containers' in application)) {
    throw new Error('AIConfig has bad formatting: application does not have valid container property');
  }

  if (!Array.isArray(application['containers'])) {
    throw new Error('AIConfig has bad formatting: containers property must be an array.');
  }

  const containers: unknown[] = application['containers'];

  return {
    application: {
      containers: containers.map(container => {
        if (!container || typeof container !== 'object') throw new Error('containers array malformed');

        let contextdir: string;
        if ('contextdir' in container) {
          contextdir = assertString(container['contextdir']);
        } else {
          contextdir = '.';
        }

        const architectures: string[] = [];
        if (!('arch' in container)) {
          architectures.push(defaultArch);
        } else if (Array.isArray(container['arch']) && container['arch'].every(arch => typeof arch === 'string')) {
          architectures.push(...container['arch']);
        } else if (typeof container['arch'] === 'string') {
          architectures.push(container['arch']);
        } else {
          throw new Error('malformed arch property');
        }

        let containerfile: string | undefined = undefined;
        if ('containerfile' in container && isString(container['containerfile'])) {
          containerfile = container['containerfile'];
        }

        if (!('name' in container) || typeof container['name'] !== 'string') {
          throw new Error('invalid name property: must be string');
        }

        return {
          arch: architectures,
          modelService: 'model-service' in container && container['model-service'] === true,
          containerfile,
          contextdir: contextdir,
          name: container['name'],
          gpu_env: 'gpu-env' in container && Array.isArray(container['gpu-env']) ? container['gpu-env'] : [],
          ports:
            'ports' in container && Array.isArray(container['ports'])
              ? container['ports'].map(port => parseInt(port))
              : [],
          image: 'image' in container && isString(container['image']) ? container['image'] : undefined,
        };
      }),
    },
  };
}
