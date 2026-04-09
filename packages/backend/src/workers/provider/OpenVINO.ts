/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import type { ContainerCreateOptions, ContainerProviderConnection, ImageInfo, MountConfig } from '@podman-desktop/api';
import type { InferenceServerConfig } from '@shared/models/InferenceServerConfig';
import { InferenceProvider } from './InferenceProvider';
import { getModelPropertiesForEnvironment, getMountPath } from '../../utils/modelsUtils';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { type InferenceServer, InferenceType } from '@shared/models/IInference';
import { VMType } from '@shared/models/IPodman';
import type { PodmanConnection } from '../../managers/podmanConnection';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { openvino } from '../../assets/inference-images.json';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { ModelsManager } from '../../managers/modelsManager';

export const SECOND: number = 1_000_000_000;

export class OpenVINO extends InferenceProvider {
  constructor(
    taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
    private modelsManager: ModelsManager,
    private configurationRegistry: ConfigurationRegistry,
  ) {
    super(taskRegistry, InferenceType.OPENVINO, 'OpenVINO');
  }

  dispose(): void {}

  public enabled = (): boolean => true;

  protected async getContainerCreateOptions(
    config: InferenceServerConfig,
    imageInfo: ImageInfo,
    modelInfo: ModelInfo,
    vmType: VMType,
  ): Promise<ContainerCreateOptions> {
    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    const labels: Record<string, string> = {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    };

    // get model mount settings
    const filename = getMountPath(modelInfo);
    const target = `/models/${modelInfo.file.file}`;

    // mount the model file
    const mounts: MountConfig = [
      {
        Target: target,
        Source: filename,
        Type: 'bind',
      },
    ];

    // provide envs
    const envs: string[] = [`MODEL_PATH=${target}`, 'HOST=0.0.0.0', 'PORT=8000'];
    envs.push(...getModelPropertiesForEnvironment(modelInfo));

    // Add OpenVINO GGML environment variables and GPU device passthrough
    const devices: { PathOnHost: string; PathInContainer: string; CgroupPermissions: string }[] = [];
    let user: string | undefined = undefined;

    if (this.configurationRegistry.getExtensionConfiguration().experimentalGPU) {
      envs.push('GGML_OPENVINO_DEVICE=GPU');
      envs.push('GGML_OPENVINO_STATEFUL_EXECUTION=1');

      if (vmType === VMType.WSL) {
        mounts.push({
          Target: '/usr/lib/wsl',
          Source: '/usr/lib/wsl',
          Type: 'bind',
        });

        devices.push({
          PathOnHost: '/dev/dxg',
          PathInContainer: '/dev/dxg',
          CgroupPermissions: 'r',
        });

        user = '0';
      } else if (vmType === VMType.UNKNOWN) {
        devices.push({
          PathOnHost: '/dev/dri',
          PathInContainer: '/dev/dri',
          CgroupPermissions: 'rwm',
        });

        user = '0';
      }
    } else {
      envs.push('GGML_OPENVINO_DEVICE=CPU');
    }

    // add the link to our openAPI instance using the instance as the host
    const aiLabPort = this.configurationRegistry.getExtensionConfiguration().apiPort;
    // add in the URL the port of the inference server
    const aiLabDocsLink = `http://localhost:${aiLabPort}/api-docs/${config.port}`;
    // adding labels to inference server
    labels['docs'] = aiLabDocsLink;
    labels['api'] = `http://localhost:${config.port}/v1`;

    return {
      Image: imageInfo.Id,
      Detach: true,
      Entrypoint: '/bin/sh',
      Cmd: ['-c', 'llama-server --model $MODEL_PATH --host $HOST --port $PORT'],
      User: user,
      ExposedPorts: { [`${config.port}`]: {} },
      HostConfig: {
        AutoRemove: false,
        Devices: devices,
        Mounts: mounts,
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
        Test: ['CMD-SHELL', `curl -sSf localhost:8000 > /dev/null`],
        Interval: SECOND * 5,
        Retries: 4 * 5,
      },
      Labels: labels,
      Env: envs,
    };
  }

  async perform(config: InferenceServerConfig): Promise<InferenceServer> {
    const modelInfo = this.validateAndGetModelInfo(config);

    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    let connection: ContainerProviderConnection | undefined = undefined;
    if (config.connection) {
      connection = this.podmanConnection.getContainerProviderConnection(config.connection);
    } else {
      connection = this.podmanConnection.findRunningContainerProviderConnection();
    }

    if (!connection) throw new Error('no running connection could be found');

    const vmType: VMType = (connection.vmType ?? VMType.UNKNOWN) as VMType;

    // pull the image
    const imageInfo: ImageInfo = await this.pullImage(
      connection,
      config.image ?? this.getOpenVINOInferenceImage(vmType),
      config.labels,
    );

    // Get the container creation options
    const containerCreateOptions: ContainerCreateOptions = await this.getContainerCreateOptions(
      config,
      imageInfo,
      modelInfo,
      vmType,
    );

    // Create the container
    const { engineId, id } = await this.createContainer(imageInfo.engineId, containerCreateOptions, config.labels);

    return {
      container: {
        engineId: engineId,
        containerId: id,
      },
      connection: {
        port: config.port,
      },
      status: 'running',
      models: config.modelsInfo.map(model => this.modelsManager.getModelInfo(model.id)),
      type: InferenceType.OPENVINO,
      labels: containerCreateOptions.Labels ?? {},
    };
  }

  private validateAndGetModelInfo(config: InferenceServerConfig): ModelInfo {
    if (!this.enabled()) throw new Error('not enabled');

    if (config.modelsInfo.length === 0) throw new Error('Need at least one model info to start an inference server.');

    if (config.modelsInfo.length > 1) {
      throw new Error('Currently the inference server does not support multiple models serving.');
    }

    return config.modelsInfo[0];
  }

  protected getOpenVINOInferenceImage(_vmType: VMType): string {
    return openvino.default;
  }
}
