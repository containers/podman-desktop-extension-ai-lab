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
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { join, posix } from 'node:path';

export const MACHINE_BASE_FOLDER = '/home/user/ai-lab/models/';

/**
 * Given a model info object return the path where is it located locally
 * @param modelInfo
 */
export function getLocalModelFile(modelInfo: ModelInfo): string {
  if (modelInfo.file === undefined) throw new Error('model is not available locally.');
  return join(modelInfo.file.path, modelInfo.file.file);
}

/**
 * Given a model info object return the theoretical path where the model
 * should be in the podman machine
 * @param modelInfo
 */
export function getRemoteModelFile(modelInfo: ModelInfo): string {
  if (modelInfo.file === undefined) throw new Error('model is not available locally.');

  return posix.join(MACHINE_BASE_FOLDER, modelInfo.file.file);
}

export function getModelPropertiesForEnvironment(modelInfo: ModelInfo): string[] {
  const envs: string[] = [];
  if (modelInfo.properties) {
    envs.push(
      ...Object.entries(modelInfo.properties).map(([key, value]) => {
        const formattedKey = key.replace(/[A-Z]/g, m => `_${m}`).toUpperCase();
        return `MODEL_${formattedKey}=${value}`;
      }),
    );
  }
  return envs;
}
