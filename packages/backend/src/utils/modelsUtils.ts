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
import type { ModelInfo } from '@shared/models/IModelInfo';
import { basename, dirname, join, posix } from 'node:path';
import { getPodmanCli } from './podman';
import { process } from '@podman-desktop/api';
import { escapeSpaces } from './pathUtils';

export const MACHINE_BASE_FOLDER = '/home/user/ai-lab/models';

/**
 * Given a model info object return the path where is it located locally
 * @param modelInfo
 */
export function getLocalModelFile(modelInfo: ModelInfo): string {
  if (modelInfo.file === undefined) throw new Error('model is not available locally.');
  return join(modelInfo.file.path, modelInfo.file.file);
}

/**
 * Return the path to mount where the model is located
 * @param modelInfo
 */
export function getMountPath(modelInfo: ModelInfo): string {
  if (modelInfo.file === undefined) throw new Error('model is not available locally.');
  // if the model is uploaded we need to use posix join
  if (modelInfo.file.path === MACHINE_BASE_FOLDER) {
    return posix.join(MACHINE_BASE_FOLDER, modelInfo.file.file);
  }
  return join(modelInfo.file.path, modelInfo.file.file);
}

/**
 * Given a model info object return the theoretical path where the model
 * should be in the podman machine
 * @param modelInfo
 */
export function getRemoteModelFile(modelInfo: ModelInfo): string {
  if (modelInfo.file === undefined) throw new Error('model is not available locally.');

  return posix.join(MACHINE_BASE_FOLDER, modelInfo.id);
}

export interface ModelMountInfo {
  mount: string;
  suffix?: string;
}

export function getHuggingFaceModelMountInfo(modelInfo: ModelInfo): ModelMountInfo {
  const localPath = getLocalModelFile(modelInfo);
  const mountPath = getMountPath(modelInfo);
  if (mountPath !== localPath) {
    return {
      mount: mountPath,
    };
  } else {
    const snapShotsFolder = dirname(localPath);
    const commitHash = basename(localPath);
    const modelFolder = dirname(snapShotsFolder);
    const snapShots = basename(snapShotsFolder);
    return {
      mount: modelFolder,
      suffix: `${snapShots}/${commitHash}`,
    };
  }
}

/**
 * utility method to determine if a model is already uploaded to the podman machine
 * @param machine
 * @param modelInfo
 */
export async function isModelUploaded(machine: string, modelInfo: ModelInfo): Promise<boolean> {
  try {
    const remotePath = escapeSpaces(getRemoteModelFile(modelInfo));
    await process.exec(getPodmanCli(), ['machine', 'ssh', machine, 'stat', remotePath]);
    return true;
  } catch (err: unknown) {
    console.error('Something went wrong while trying to stat remote model path', err);
    return false;
  }
}

/**
 * Given a machine and a modelInfo, delete the corresponding file on the podman machine
 * @param machine the machine to target
 * @param modelInfo the model info
 */
export async function deleteRemoteModel(machine: string, modelInfo: ModelInfo): Promise<void> {
  try {
    const remotePath = getRemoteModelFile(modelInfo);
    await process.exec(getPodmanCli(), ['machine', 'ssh', machine, 'rm', '-f', remotePath]);
  } catch (err: unknown) {
    console.error('Something went wrong while trying to stat remote model path', err);
  }
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
