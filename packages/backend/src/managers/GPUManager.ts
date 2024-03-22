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
import { containerEngine, type Disposable, type Webview, type ImageInfo, type PullEvent } from '@podman-desktop/api';
import { getImageInfo, getProviderContainerConnection } from '../utils/inferenceUtils';
import { XMLParser } from 'fast-xml-parser';
import type { IGPUInfo } from '@shared/src/models/IGPUInfo';
import { Publisher } from '../utils/Publisher';
import { Messages } from '@shared/Messages';

export const CUDA_11_7_IMAGES = 'nvcr.io/nvidia/cuda:11.7.0-base-ubuntu20.04';

/**
 * @experimental
 */
export class GPUManager extends Publisher<IGPUInfo[]> implements Disposable {
  // Map uuid -> info
  #gpus: Map<string, IGPUInfo>;

  constructor(webview: Webview) {
    super(webview, Messages.MSG_GPUS_UPDATE, () => this.getAll());
    this.#gpus = new Map();
  }
  dispose(): void {
    this.#gpus.clear();
  }

  getAll(): IGPUInfo[] {
    return Array.from(this.#gpus.values());
  }

  async collectGPUs(options?: { providerId: string }): Promise<void> {
    const provider = getProviderContainerConnection(options?.providerId);
    const imageInfo: ImageInfo = await getImageInfo(provider.connection, CUDA_11_7_IMAGES, (_event: PullEvent) => {});

    console.log('getGPUs createContainer');
    const result = await containerEngine.createContainer(
      imageInfo.engineId,
      {
        Image: imageInfo.Id,
        Detach: false,
        HostConfig: {
          AutoRemove: false,
          Mounts: [
            {
              Target: '/usr/lib/wsl',
              Source: '/usr/lib/wsl',
              Type: 'bind',
            },
          ],
          DeviceRequests: [{
            Capabilities: [['gpu']],
            Count: -1, // -1: all
          }],
          Devices: [{
            PathOnHost: '/dev/dxg',
            PathInContainer: '/dev/dxg',
            CgroupPermissions: 'r',
          }],
        },
        Cmd: ['bash', '-c', '/usr/bin/ln -s /usr/lib/wsl/lib/* /usr/lib/x86_64-linux-gnu/ && PATH="${PATH}:/usr/lib/wsl/lib/" && nvidia-smi -x -q'],
      },
    );

    try {
      const logs = await this.getLogs(imageInfo.engineId, result.id);
      const parsed: {
        nvidia_smi_log: {
          attached_gpus: number,
          cuda_version: number,
          driver_version: number,
          timestamp: string,
          gpu: IGPUInfo,
        }
      } = new XMLParser().parse(logs);

      if(parsed.nvidia_smi_log.attached_gpus > 1)
        throw new Error('machine with more than one GPU are not supported.');

      this.#gpus.set(parsed.nvidia_smi_log.gpu.uuid, parsed.nvidia_smi_log.gpu);
      this.notify();
    } finally {
      await containerEngine.deleteContainer(imageInfo.engineId, result.id);
    }
  }

  private getLogs(engineId: string, containerId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const interval = setTimeout(() => {
        reject(new Error('timeout'));
      }, 10000);

      let logs = '';
      containerEngine.logsContainer(engineId, containerId, (name, data) => {
        logs += data;
        if(data.includes('</nvidia_smi_log>')) {
          clearTimeout(interval);
          resolve(logs);
        }
      }).catch(reject);
    });
  }

}
