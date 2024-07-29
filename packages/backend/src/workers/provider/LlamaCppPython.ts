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
import type { ContainerCreateOptions, DeviceRequest, ImageInfo, MountConfig } from '@podman-desktop/api';
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

export const LLAMA_CPP_CPU = 'ghcr.io/containers/llamacpp_python:latest';
export const LLAMA_CPP_CUDA = 'ghcr.io/containers/llamacpp_python_cuda:latest';

export const LLAMA_CPP_MAC_GPU = 'quay.io/ai-lab/llamacpp-python-vulkan:latest';

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

  dispose() {}

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
      // mounting

      switch (vmType) {
        case VMType.WSL:
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
            '/usr/bin/ln -s /usr/lib/wsl/lib/* /usr/lib64/ && PATH="${PATH}:/usr/lib/wsl/lib/" && chmod 755 ./run.sh && ./run.sh',
          ];
          break;
        case VMType.LIBKRUN:
          devices.push({
            PathOnHost: '/dev/dri',
            PathInContainer: '/dev/dri',
            CgroupPermissions: 'r',
          });
          break;
      }

      // adding gpu capabilities
      deviceRequests.push({
        Capabilities: [['gpu']],
        Count: -1, // -1: all
      });

      // all gpus
      labels['gpu'] = gpu.model;
      envs.push(`GPU_LAYERS=${config.gpuLayers}`);
    }

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
      if (gpus.length > 1)
        console.warn(`found ${gpus.length} gpus: using multiple GPUs is not supported. Using ${gpus[0].model}.`);
      gpu = gpus[0];
    }

    const vmType = await this.podmanConnection.getVMType();

    // pull the image
    const imageInfo: ImageInfo = await this.pullImage(
      config.providerId,
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
      labels: containerCreateOptions.Labels || {},
    };
  }

  protected getLlamaCppInferenceImage(vmType: VMType, gpu?: IGPUInfo): string {
    switch (vmType) {
      case VMType.WSL:
        return gpu?.vendor === GPUVendor.NVIDIA ? LLAMA_CPP_CUDA : LLAMA_CPP_CPU;
      case VMType.LIBKRUN:
        return gpu ? LLAMA_CPP_MAC_GPU : LLAMA_CPP_CPU;
      // no GPU support
      case VMType.QEMU:
      case VMType.APPLEHV:
      case VMType.HYPERV:
        return LLAMA_CPP_CPU;
      case VMType.UNKNOWN:
        return LLAMA_CPP_CPU;
    }
  }
}
