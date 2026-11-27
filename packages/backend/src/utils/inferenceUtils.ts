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
import {
  containerEngine,
  type ContainerProviderConnection,
  type ImageInfo,
  type ListImagesOptions,
  type PullEvent,
} from '@podman-desktop/api';
import type { CreationInferenceServerOptions, InferenceServerConfig } from '@shared/models/InferenceServerConfig';
import { getFreeRandomPort } from './ports';
import { type InferenceServer, InferenceType } from '@shared/models/IInference';
import type { ModelInfo } from '@shared/models/IModelInfo';

export const LABEL_INFERENCE_SERVER: string = 'ai-lab-inference-server';

/**
 * Given an image name, it will return the ImageInspectInfo corresponding. Will raise an error if not found.
 * @param connection
 * @param image
 * @param callback
 */
export async function getImageInfo(
  connection: ContainerProviderConnection,
  image: string,
  callback: (event: PullEvent) => void,
): Promise<ImageInfo> {
  let imageInfo: ImageInfo | undefined;
  // Get image inspect
  imageInfo = (
    await containerEngine.listImages({
      provider: connection,
    } as ListImagesOptions)
  ).find(imageInfo => imageInfo.RepoTags?.some(tag => tag === image));
  if (!imageInfo) {
    try {
      // Pull image
      await containerEngine.pullImage(connection, image, callback);
      // Get image inspect
      imageInfo = (
        await containerEngine.listImages({
          provider: connection,
        } as ListImagesOptions)
      ).find(imageInfo => imageInfo.RepoTags?.some(tag => tag === image));
    } catch (err: unknown) {
      console.warn('Something went wrong while trying to get image inspect', err);
      throw err;
    }
  }

  if (imageInfo === undefined) throw new Error(`image ${image} not found.`);

  return imageInfo;
}

export async function withDefaultConfiguration(
  options: CreationInferenceServerOptions,
): Promise<InferenceServerConfig> {
  if (options.modelsInfo.length === 0) throw new Error('modelsInfo need to contain at least one element.');

  return {
    port: options.port ?? (await getFreeRandomPort('0.0.0.0')),
    image: options.image,
    labels: options.labels ?? {},
    modelsInfo: options.modelsInfo,
    connection: options.connection,
    inferenceProvider: options.inferenceProvider,
    backend: options.backend,
    gpuLayers: options.gpuLayers,
  };
}

export function isTransitioning(server: InferenceServer): boolean {
  switch (server.status) {
    case 'deleting':
    case 'stopping':
    case 'starting':
      return true;
    default:
      break;
  }

  return false;
}

/**
 * Given a primitive (string) return the InferenceType enum
 * @param value
 */
export function parseInferenceType(value: string | undefined): InferenceType {
  if (!value) return InferenceType.NONE;
  return (Object.values(InferenceType) as unknown as string[]).includes(value)
    ? (value as unknown as InferenceType)
    : InferenceType.NONE;
}

/**
 * Return the backends supported by a model, in order of preference.
 * A model without backend is considered as having the NONE backend.
 */
export function getModelInferenceTypes(modelInfo: ModelInfo): InferenceType[] {
  const backends = (modelInfo.backends ?? []).map(backend => parseInferenceType(backend));
  return backends.length > 0 ? [...new Set(backends)] : [InferenceType.NONE];
}

/**
 * Let's collect the backends supported by all the provided models,
 * in the order of preference of the first model.
 */
export function getInferenceTypes(modelsInfo: ModelInfo[]): InferenceType[] {
  if (modelsInfo.length === 0) return [];
  const [first, ...others] = modelsInfo.map(info => getModelInferenceTypes(info));
  return first.filter(backend => others.every(backends => backends.includes(backend)));
}

/**
 * Let's collect the preferred backend supported by all the provided models.
 * If the models do not have any backend in common, NONE will be returned
 */
export function getInferenceType(modelsInfo: ModelInfo[]): InferenceType {
  return getInferenceTypes(modelsInfo)[0] ?? InferenceType.NONE;
}
