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
import type {
  ContainerCreateOptions,
  ContainerProviderConnection,
  DeviceRequest,
  ImageInfo,
  MountConfig,
} from '@podman-desktop/api';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import { InferenceProvider } from './InferenceProvider';
import { getModelPropertiesForEnvironment } from '../../utils/modelsUtils';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { LABEL_INFERENCE_SERVER } from '../../utils/inferenceUtils';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { type InferenceServer, InferenceType } from '@shared/src/models/IInference';
import type { GPUManager } from '../../managers/GPUManager';
import { GPUVendor, type IGPUInfo } from '@shared/src/models/IGPUInfo';
import { VMType } from '@shared/src/models/IPodman';
import type { PodmanConnection } from '../../managers/podmanConnection';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { llamacpp } from '../../assets/inference-images.json';

export const SECOND: number = 1_000_000_000;

interface Device {
  PathOnHost: string;
  PathInContainer: string;
  CgroupPermissions: string;
}

export class LlamaCppPython extends InferenceProvider {
  constructor(
    taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
    private gpuManager: GPUManager,
    private configurationRegistry: ConfigurationRegistry,
  ) {
    super(taskRegistry, InferenceType.LLAMA_CPP, 'LLama-cpp');
  }

  dispose(): void {}

  public enabled = (): boolean => true;

  protected async getContainerCreateOptions(
    config: InferenceServerConfig,
    imageInfo: ImageInfo,
    vmType: VMType,
    gpu?: IGPUInfo,
  ): Promise<ContainerCreateOptions> {
    if (config.modelsInfo.length === 0) throw new Error('Need at least one model info to start an inference server.');

    if (config.modelsInfo.length > 1) {
      throw new Error('Currently the inference server does not support multiple models serving.');
    }

    const modelInfo = config.modelsInfo[0];

    if (modelInfo.file === undefined) {
      throw new Error('The model info file provided is undefined');
    }

    const labels: Record<string, string> = {
      ...config.labels,
      [LABEL_INFERENCE_SERVER]: JSON.stringify(config.modelsInfo.map(model => model.id)),
    };

    const envs: string[] = [`MODEL_PATH=/models/${modelInfo.file.file}`, 'HOST=0.0.0.0', 'PORT=8000'];
    envs.push(...getModelPropertiesForEnvironment(modelInfo));

    const mounts: MountConfig = [
      {
        Target: '/models',
        Source: modelInfo.file.path,
        Type: 'bind',
      },
    ];

    const deviceRequests: DeviceRequest[] = [];
    const devices: Device[] = [];
    let entrypoint: string | undefined = undefined;
    let cmd: string[] = [];
    let user: string | undefined = undefined;

    if (gpu) {
      let supported: boolean = false;
      switch (vmType) {
        case VMType.WSL:
          // WSL Only support NVIDIA
          if (gpu.vendor !== GPUVendor.NVIDIA) break;

          supported = true;
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

          entrypoint = '/usr/bin/sh';
          cmd = [
            '-c',
            '/usr/bin/ln -sfn /usr/lib/wsl/lib/* /usr/lib64/ && PATH="${PATH}:/usr/lib/wsl/lib/" && chmod 755 ./run.sh && ./run.sh',
          ];
          break;
        case VMType.LIBKRUN:
        case VMType.LIBKRUN_LABEL:
          supported = true;
          devices.push({
            PathOnHost: '/dev/dri',
            PathInContainer: '/dev/dri',
            CgroupPermissions: '',
          });
          break;
        case VMType.UNKNOWN:
          // Only supports NVIDIA
          if (gpu.vendor !== GPUVendor.NVIDIA) break;

          supported = true;
          devices.push({
            PathOnHost: 'nvidia.com/gpu=all',
            PathInContainer: '',
            CgroupPermissions: '',
          });

          user = '0';

          entrypoint = '/usr/bin/sh';

          cmd = ['-c', 'chmod 755 ./run.sh && ./run.sh'];

          break;
      }

      // adding gpu capabilities in supported architectures
      if (supported) {
        deviceRequests.push({
          Capabilities: [['gpu']],
          Count: -1, // -1: all
        });

        // label the container
        labels['gpu'] = gpu.model;
        envs.push(`GPU_LAYERS=${config.gpuLayers}`);
      } else {
        console.warn(`gpu ${gpu.model} is not supported on ${vmType}.`);
      }
    }

    // adding labels to inference server
    labels['docs'] = `http://localhost:${config.port}/docs`;
    labels['api'] = `http://localhost:${config.port}/v1`;

    return {
      Image: imageInfo.Id,
      Detach: true,
      Entrypoint: entrypoint,
      User: user,
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
        Test: ['CMD-SHELL', `curl -sSf localhost:8000/docs > /dev/null`],
        Interval: SECOND * 5,
        Retries: 4 * 5,
      },
      Labels: labels,
      Env: envs,
      Cmd: cmd,
    };
  }

  async perform(config: InferenceServerConfig): Promise<InferenceServer> {
    if (!this.enabled()) throw new Error('not enabled');

    let gpu: IGPUInfo | undefined = undefined;

    // get the first GPU if option is enabled
    if (this.configurationRegistry.getExtensionConfiguration().experimentalGPU) {
      const gpus: IGPUInfo[] = await this.gpuManager.collectGPUs();
      if (gpus.length === 0) throw new Error('no gpu was found.');
      let selectedGPU = 0;
      if (gpus.length > 1) {
        // Look for a GPU that is of a known type, use the first one found.
        // Fall back to the first one if no GPUs are of known type.
        for (let i = 0; i < gpus.length; i++) {
          if (gpus[i].vendor !== GPUVendor.UNKNOWN) {
            selectedGPU = i;
            break;
          }
        }
        console.warn(
          `found ${gpus.length} gpus: using multiple GPUs is not supported. Using ${gpus[selectedGPU].model}.`,
        );
      }
      gpu = gpus[selectedGPU];
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
      config.image ?? this.getLlamaCppInferenceImage(vmType, gpu),
      config.labels,
    );

    // Get the container creation options
    const containerCreateOptions: ContainerCreateOptions = await this.getContainerCreateOptions(
      config,
      imageInfo,
      vmType,
      gpu,
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
      models: config.modelsInfo,
      type: InferenceType.LLAMA_CPP,
      labels: containerCreateOptions.Labels ?? {},
    };
  }

  protected getLlamaCppInferenceImage(vmType: VMType, gpu?: IGPUInfo): string {
    switch (vmType) {
      case VMType.WSL:
        return gpu?.vendor === GPUVendor.NVIDIA ? llamacpp.cuda : llamacpp.default;
      case VMType.LIBKRUN:
      case VMType.LIBKRUN_LABEL:
        return gpu ? llamacpp.vulkan : llamacpp.default;
      // no GPU support
      case VMType.UNKNOWN:
        return gpu?.vendor === GPUVendor.NVIDIA ? llamacpp.cuda : llamacpp.default;
      default:
        return llamacpp.default;
    }
  }
}
