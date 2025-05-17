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

import { InferenceProvider } from './InferenceProvider';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { type InferenceServer, InferenceType } from '@shared/models/IInference';
import type { InferenceServerConfig } from '@shared/models/InferenceServerConfig';
import type { ContainerProviderConnection, MountConfig } from '@podman-desktop/api';
import * as images from '../../assets/inference-images.json';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { getHuggingFaceModelMountInfo } from '../../utils/modelsUtils';
import { SECOND } from './LlamaCppPython';

export class VLLM extends InferenceProvider {
  constructor(
    taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
  ) {
    super(taskRegistry, InferenceType.VLLM, 'vllm');
  }

  dispose(): void {}

  public enabled = (): boolean => true;

  /**
   * Here is an example
   *
   * podman run -it --rm
   *  -v C:\Users\axels\.cache\huggingface\hub\models--mistralai--Mistral-7B-v0.1:/cache/models--mistralai--Mistral-7B-v0.1
   *  -e HF_HUB_CACHE=/cache
   *  localhost/vllm-cpu-env:latest
   *  --model=/cache/models--mistralai--Mistral-7B-v0.1/snapshots/7231864981174d9bee8c7687c24c8344414eae6b
   *
   * @param config
   */
  override async perform(config: InferenceServerConfig): Promise<InferenceServer> {
    if (config.modelsInfo.length !== 1)
      throw new Error(`only one model is supported, received ${config.modelsInfo.length}`);

    const modelInfo = config.modelsInfo[0];
    if (modelInfo.backend !== InferenceType.VLLM) {
      throw new Error(`VLLM requires models with backend type ${InferenceType.VLLM} got ${modelInfo.backend}.`);
    }

    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    console.log('[VLLM]', config);
    console.log('[VLLM] modelInfo.file', modelInfo.file.path);

    // something ~/.cache/huggingface/hub/models--facebook--opt-125m/snapshots
    // modelInfo.file.path

    // get model mount settings
    const mountInfo = getHuggingFaceModelMountInfo(modelInfo);
    const modelCache = mountInfo.suffix ? `/cache/${mountInfo.suffix}` : '/cache';

    let connection: ContainerProviderConnection | undefined;
    if (config.connection) {
      connection = this.podmanConnection.getContainerProviderConnection(config.connection);
    } else {
      connection = this.podmanConnection.findRunningContainerProviderConnection();
    }

    if (!connection) throw new Error('no running connection could be found');

    const labels: Record<string, string> = {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    };

    const imageInfo = await this.pullImage(connection, config.image ?? images.vllm.default, labels);
    // https://huggingface.co/docs/transformers/main/en/installation#offline-mode
    // HF_HUB_OFFLINE in main
    // TRANSFORMERS_OFFLINE for legacy
    const envs: string[] = [`HF_HUB_CACHE=/cache`, 'TRANSFORMERS_OFFLINE=1', 'HF_HUB_OFFLINE=1'];

    labels['api'] = `http://localhost:${config.port}/v1`;

    const mounts: MountConfig = [
      {
        Target: `/cache`,
        Source: mountInfo.mount,
        Type: 'bind',
      },
    ];

    const containerInfo = await this.createContainer(
      imageInfo.engineId,
      {
        Image: imageInfo.Id,
        Detach: true,
        Labels: labels,
        HostConfig: {
          AutoRemove: false,
          Mounts: mounts,
          PortBindings: {
            '8000/tcp': [
              {
                HostPort: `${config.port}`,
              },
            ],
          },
          SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
        },
        HealthCheck: {
          // must be the port INSIDE the container not the exposed one
          Test: ['CMD-SHELL', `curl -sSf localhost:8000/version > /dev/null`],
          Interval: SECOND * 5,
          Retries: 4 * 5,
        },
        Env: envs,
        Cmd: [
          `--model=${modelCache}`,
          `--served_model_name=${modelInfo.name}`,
          '--chat-template-content-format=openai',
        ],
      },
      labels,
    );

    return {
      models: [modelInfo],
      status: 'running',
      connection: {
        port: config.port,
      },
      container: {
        containerId: containerInfo.id,
        engineId: containerInfo.engineId,
      },
      type: InferenceType.VLLM,
      labels: labels,
    };
  }
}
