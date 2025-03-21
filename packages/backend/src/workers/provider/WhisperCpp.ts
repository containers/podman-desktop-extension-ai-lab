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
import type { InferenceServer } from '@shared/models/IInference';
import { InferenceType } from '@shared/models/IInference';
import type { InferenceServerConfig } from '@shared/models/InferenceServerConfig';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { ContainerProviderConnection, MountConfig } from '@podman-desktop/api';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { whispercpp } from '../../assets/inference-images.json';
import type { PodmanConnection } from '../../managers/podmanConnection';
import { getMountPath } from '../../utils/modelsUtils';

export class WhisperCpp extends InferenceProvider {
  constructor(
    taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
  ) {
    super(taskRegistry, InferenceType.WHISPER_CPP, 'Whisper-cpp');
  }

  override enabled(): boolean {
    return true;
  }

  override async perform(config: InferenceServerConfig): Promise<InferenceServer> {
    if (config.modelsInfo.length === 0) throw new Error('Need at least one model info to start an inference server.');

    const modelInfo = config.modelsInfo[0];

    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    if (modelInfo.backend !== InferenceType.WHISPER_CPP) {
      throw new Error(
        `Whisper requires models with backend type ${InferenceType.WHISPER_CPP} got ${modelInfo.backend}.`,
      );
    }

    const labels: Record<string, string> = {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    };

    let connection: ContainerProviderConnection | undefined = undefined;
    if (config.connection) {
      connection = this.podmanConnection.getContainerProviderConnection(config.connection);
    } else {
      connection = this.podmanConnection.findRunningContainerProviderConnection();
    }

    if (!connection) throw new Error('no running connection could be found');

    // get model mount settings
    const filename = getMountPath(modelInfo);
    const target = `/models/${modelInfo.file.file}`;

    // mount the file directory to avoid adding other files to the containers
    const mounts: MountConfig = [
      {
        Target: target,
        Source: filename,
        Type: 'bind',
      },
    ];

    const imageInfo = await this.pullImage(connection, config.image ?? whispercpp.default, labels);
    const envs: string[] = [`MODEL_PATH=${target}`, 'HOST=0.0.0.0', 'PORT=8000'];

    labels['api'] = `http://localhost:${config.port}/inference`;

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
        Env: envs,
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
      type: InferenceType.WHISPER_CPP,
      labels: labels,
    };
  }
  override dispose(): void {}
}
