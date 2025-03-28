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
import type {
  ContainerCreateOptions,
  ContainerProviderConnection,
  DeviceRequest,
  ImageInfo,
  MountConfig,
} from '@podman-desktop/api';
import type { InferenceServerConfig } from '@shared/models/InferenceServerConfig';
import { InferenceProvider } from './InferenceProvider';
import { getModelPropertiesForEnvironment, getMountPath } from '../../utils/modelsUtils';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { type InferenceServer, InferenceType } from '@shared/models/IInference';
import { GPUVendor, type IGPUInfo } from '@shared/models/IGPUInfo';
import { VMType } from '@shared/models/IPodman';
import type { PodmanConnection } from '../../managers/podmanConnection';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { openvino } from '../../assets/inference-images.json';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { ModelsManager } from '../../managers/modelsManager';

export const SECOND: number = 1_000_000_000;

const CONFIG_FILE_NAME = `config-all.json`;

const GRAPH_CONTENT = `input_stream: "HTTP_REQUEST_PAYLOAD:input"
output_stream: "HTTP_RESPONSE_PAYLOAD:output"

node: {
  name: "LLMExecutor"
  calculator: "HttpLLMCalculator"
  input_stream: "LOOPBACK:loopback"
  input_stream: "HTTP_REQUEST_PAYLOAD:input"
  input_side_packet: "LLM_NODE_RESOURCES:llm"
  output_stream: "LOOPBACK:loopback"
  output_stream: "HTTP_RESPONSE_PAYLOAD:output"
  input_stream_info: {
    tag_index: 'LOOPBACK:0',
    back_edge: true
  }
  node_options: {
      [type.googleapis.com / mediapipe.LLMCalculatorOptions]: {
          models_path: "./",
          plugin_config: '{ "KV_CACHE_PRECISION": "u8"}',
          enable_prefix_caching: false,
          cache_size: 10,
          max_num_seqs: 256,
          device: "CPU",
      }
  }
  input_stream_handler {
    input_stream_handler: "SyncSetInputStreamHandler",
    options {
      [mediapipe.SyncSetInputStreamHandlerOptions.ext] {
        sync_set {
          tag_index: "LOOPBACK:0"
        }
      }
    }
  }
}`;

interface Device {
  PathOnHost: string;
  PathInContainer: string;
  CgroupPermissions: string;
}

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
  ): Promise<ContainerCreateOptions> {
    const labels: Record<string, string> = {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    };

    // get model mount settings
    const filename = getMountPath(modelInfo);
    const target = `/model`;

    // mount the file directory to avoid adding other files to the containers
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

    const deviceRequests: DeviceRequest[] = [];
    const devices: Device[] = [];
    const cmd: string[] = ['--rest_port', '8000', '--config_path', `/model/${CONFIG_FILE_NAME}`, '--metrics_enable'];

    // add the link to our openAPI instance using the instance as the host
    const aiLabPort = this.configurationRegistry.getExtensionConfiguration().apiPort;
    // add in the URL the port of the inference server
    const aiLabDocsLink = `http://localhost:${aiLabPort}/api-docs/${config.port}`;
    // adding labels to inference server
    labels['docs'] = aiLabDocsLink;
    labels['api'] = `http://localhost:${config.port}/v3`;

    return {
      Image: imageInfo.Id,
      Detach: true,
      ExposedPorts: { [`${config.port}`]: {} },
      HostConfig: {
        AutoRemove: false,
        Devices: devices,
        Mounts: mounts,
        DeviceRequests: deviceRequests,
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
        Test: ['CMD-SHELL', `curl -sSf localhost:8000/metrics > /dev/null`],
        Interval: SECOND * 5,
        Retries: 4 * 5,
      },
      Labels: labels,
      Env: envs,
      Cmd: cmd,
    };
  }

  override async prePerform(config: InferenceServerConfig): Promise<void> {
    const modelInfo = this.validateAndGetModelInfo(config);

    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    await this.ensureGraphFile(modelInfo.file.path);

    await this.ensureConfigFile(modelInfo);
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

  private async ensureGraphFile(modelFolder: string): Promise<string> {
    // check if the file exists
    const graphFile = `${modelFolder}/graph.pbtxt`;
    // check if the graph file exists
    if (!existsSync(graphFile)) {
      // create the graph file
      await writeFile(graphFile, GRAPH_CONTENT);
    }
    return graphFile;
  }

  private async ensureConfigFile(modelInfo: ModelInfo): Promise<string> {
    const configFile = `${modelInfo.file?.path}/${CONFIG_FILE_NAME}`;
    if (!existsSync(configFile)) {
      const config = {
        mediapipe_config_list: [
          {
            name: modelInfo.name,
            base_path: '.',
          },
        ],
        model_config_list: [],
      };
      await writeFile(configFile, JSON.stringify(config));
    }
    return configFile;
  }

  protected getOpenVINOInferenceImage(_vmType: VMType): string {
    return openvino.default;
  }

  protected isNvidiaCDIConfigured(gpu?: IGPUInfo): boolean {
    // NVIDIA cdi must be set up to use GPU acceleration on Linux.
    // Check the known locations for the configuration file
    const knownLocations = [
      '/etc/cdi/nvidia.yaml', // Fedora
    ];

    if (gpu?.vendor !== GPUVendor.NVIDIA) return false;

    let cdiSetup = false;
    for (const location of knownLocations) {
      if (existsSync(location)) {
        cdiSetup = true;
        break;
      }
    }
    return cdiSetup;
  }
}
