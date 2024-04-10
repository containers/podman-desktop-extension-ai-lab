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
  provider,
  type ContainerCreateOptions,
  type ContainerProviderConnection,
  type PullEvent,
  type ProviderContainerConnection,
  type ImageInfo,
  type ListImagesOptions,
} from '@podman-desktop/api';
import type { CreationInferenceServerOptions, InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from './utils';
import { getFreeRandomPort } from './ports';

export const SECOND: number = 1_000_000_000;

export const LABEL_INFERENCE_SERVER: string = 'ai-lab-inference-server';

export const INFERENCE_SERVER_IMAGE =
  'ghcr.io/containers/podman-desktop-extension-ai-lab-playground-images/ai-lab-playground-chat:0.2.0';

/**
 * Return container connection provider
 */
export function getProviderContainerConnection(providerId?: string): ProviderContainerConnection {
  // Get started providers
  const providers = provider
    .getContainerConnections()
    .filter(connection => connection.connection.status() === 'started');

  if (providers.length === 0) throw new Error('no engine started could be find.');

  let output: ProviderContainerConnection | undefined = undefined;

  // If we expect a specific engine
  if (providerId !== undefined) {
    output = providers.find(engine => engine.providerId === providerId);
  } else {
    // Have a preference for a podman engine
    output = providers.find(engine => engine.connection.type === 'podman');
    if (output === undefined) {
      output = providers[0];
    }
  }
  if (output === undefined) throw new Error('cannot find any started container provider.');
  return output;
}

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
  let imageInfo: ImageInfo;
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

  if (imageInfo === undefined) throw new Error(`image ${image} not found.`);

  return imageInfo;
}

/**
 * Given an {@link InferenceServerConfig} and an {@link ImageInfo} generate a container creation options object
 * @param config the config to use
 * @param imageInfo the image to use
 */
export function generateContainerCreateOptions(
  config: InferenceServerConfig,
  imageInfo: ImageInfo,
): ContainerCreateOptions {
  if (config.modelsInfo.length === 0) throw new Error('Need at least one model info to start an inference server.');

  if (config.modelsInfo.length > 1) {
    throw new Error('Currently the inference server does not support multiple models serving.');
  }

  const modelInfo = config.modelsInfo[0];

  if (modelInfo.file === undefined) {
    throw new Error('The model info file provided is undefined');
  }

  const envs: string[] = [`MODEL_PATH=/models/${modelInfo.file.file}`, 'HOST=0.0.0.0', 'PORT=8000'];
  if(modelInfo.chatformat) {
    envs.push(`CHAT_FORMAT=${modelInfo.chatformat}`);
  }

  return {
    Image: imageInfo.Id,
    Detach: true,
    ExposedPorts: { [`${config.port}`]: {} },
    HostConfig: {
      AutoRemove: false,
      Mounts: [
        {
          Target: '/models',
          Source: modelInfo.file.path,
          Type: 'bind',
        },
      ],
      SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
      PortBindings: {
        '8000/tcp': [
          {
            HostPort: `${config.port}`,
          },
        ],
      },
    },
    HealthCheck: {
      // must be the port INSIDE the container not the exposed one
      Test: ['CMD-SHELL', `curl -sSf localhost:8000/docs > /dev/null`],
      Interval: SECOND * 5,
      Retries: 4 * 5,
    },
    Labels: {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    },
    Env: envs,
    Cmd: ['--models-path', '/models', '--context-size', '700', '--threads', '4'],
  };
}

export async function withDefaultConfiguration(
  options: CreationInferenceServerOptions,
): Promise<InferenceServerConfig> {
  if (options.modelsInfo.length === 0) throw new Error('modelsInfo need to contain at least one element.');

  return {
    port: options.port || (await getFreeRandomPort('0.0.0.0')),
    image: options.image || INFERENCE_SERVER_IMAGE,
    labels: options.labels || {},
    modelsInfo: options.modelsInfo,
    providerId: options.providerId,
  };
}
