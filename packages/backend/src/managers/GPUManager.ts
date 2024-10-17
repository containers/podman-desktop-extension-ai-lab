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
  type ContainerProviderConnection,
  type Disposable,
  type Webview,
  process,
  type RunResult,
  env,
} from '@podman-desktop/api';
import {
  type ContainerDeviceInterface,
  GPUVendor,
  type IGPUInfo,
  type NvidiaCTKVersion,
} from '@shared/src/models/IGPUInfo';
import { Publisher } from '../utils/Publisher';
import { Messages } from '@shared/Messages';
import { graphics } from 'systeminformation';
import type { PodmanConnection } from './podmanConnection';
import { load } from 'js-yaml';
import { readFile, stat } from 'node:fs/promises';

/**
 * @experimental
 */
export class GPUManager extends Publisher<IGPUInfo[]> implements Disposable {
  #gpus: IGPUInfo[];

  constructor(
    webview: Webview,
    private podman: PodmanConnection,
  ) {
    super(webview, Messages.MSG_GPUS_UPDATE, () => this.getAll());
    // init properties
    this.#gpus = [];
  }

  dispose(): void {}

  getAll(): IGPUInfo[] {
    return this.#gpus;
  }

  async collectGPUs(): Promise<IGPUInfo[]> {
    const { controllers } = await graphics();
    this.#gpus = controllers.map(controller => ({
      vendor: this.getVendor(controller.vendor),
      model: controller.model,
      vram: controller.vram ?? undefined,
    }));
    return this.getAll();
  }

  protected getVendor(raw: string): GPUVendor {
    switch (raw) {
      case 'Intel Corporation':
        return GPUVendor.INTEL;
      case 'NVIDIA':
        return GPUVendor.NVIDIA;
      case 'Apple':
        return GPUVendor.APPLE;
      default:
        return GPUVendor.UNKNOWN;
    }
  }

  protected parseNvidiaCTKVersion(stdout: string): NvidiaCTKVersion {
    const lines = stdout.split('\n');
    if (lines.length !== 2) throw new Error('malformed version output');
    return {
      version: lines[0].substring('NVIDIA Container Toolkit CLI version'.length).trim(),
      commit: lines[1].substring('commit:'.length).trim(),
    };
  }

  protected async getNvidiaContainerToolKitVersion(connection: ContainerProviderConnection): Promise<NvidiaCTKVersion> {
    let result: RunResult;

    if (connection.vmType) {
      // if vmType is defined we are working with virtual machine so we need to SSH in it
      result = await this.podman.executeSSH(connection, ['nvidia-ctk', '--quiet', '-v']);
    } else if (env.isLinux) {
      // if vmType is undefined on linux system we are working with podman native
      result = await process.exec('nvidia-ctk', ['--quiet', '-v']);
    } else {
      throw new Error('cannot determine the environment to execute nvidia-ctk');
    }
    if (result.stderr.length > 0) throw new Error(result.stderr);
    return this.parseNvidiaCTKVersion(result.stdout);
  }

  protected parseNvidiaCDI(stdout: string): ContainerDeviceInterface {
    const containerDeviceInterface: unknown = load(stdout);
    if (!containerDeviceInterface || typeof containerDeviceInterface !== 'object')
      throw new Error('malformed output nvidia CDI output');
    if (!('cdiVersion' in containerDeviceInterface)) throw new Error('missing cdiVersion in nvidia CDI');
    if (containerDeviceInterface.cdiVersion !== '0.3.0')
      throw new Error('invalid cdiVersion: expected 0.3.0 received containerDeviceInterface.cdiVersion');

    if (!('kind' in containerDeviceInterface)) throw new Error('missing kind in nvidia CDI');
    if (typeof containerDeviceInterface.kind !== 'string') throw new Error('malformed kind in nvidia CDI');

    if (!('devices' in containerDeviceInterface)) throw new Error('missing devices in nvidia CDI');
    if (!Array.isArray(containerDeviceInterface.devices)) throw new Error('devices is malformed in nvidia CDI');

    return {
      cdiVersion: containerDeviceInterface.cdiVersion,
      kind: containerDeviceInterface.kind,
      devices: containerDeviceInterface.devices,
    };
  }

  /**
   * This method will parse the `/etc/cdi/nvidia.yaml` in the available ContainerProviderConnection
   * @protected
   */
  protected async getNvidiaCDI(connection: ContainerProviderConnection): Promise<ContainerDeviceInterface> {
    if (connection.vmType) {
      // if vmType is defined we are working with virtual machine so we need to SSH in it
      const { stdout, stderr } = await this.podman.executeSSH(connection, ['cat', '/etc/cdi/nvidia.yaml']);
      if (stderr.length > 0) throw new Error(stderr);
      return this.parseNvidiaCDI(stdout);
    }

    if (!env.isLinux) {
      throw new Error('cannot determine the environment to read nvidia CDI file');
    }

    // if vmType is undefined on linux system we are working with podman native
    const info = await stat('/etc/cdi/nvidia.yaml');
    if (!info.isFile()) throw new Error('invalid /etc/cdi/nvidia.yaml file');

    const content = await readFile('/etc/cdi/nvidia.yaml', { encoding: 'utf8' });
    return this.parseNvidiaCDI(content);
  }

  /**
   * see https://github.com/cncf-tags/container-device-interface
   * @param connection
   */
  public async getGPUContainerDeviceInterface(
    connection: ContainerProviderConnection,
  ): Promise<ContainerDeviceInterface> {
    const gpus = this.getAll();
    // ensure at least one GPU is available
    if (gpus.length === 0) {
      throw new Error('no gpu has been detected');
    }

    // ensure all GPU(s) are NVIDIA vendor
    if (gpus.some(gpu => gpu.vendor !== GPUVendor.NVIDIA)) {
      throw new Error('cannot get container device interface for non-nvidia GPU(s)');
    }

    // check nvidia-ctk version
    const { version } = await this.getNvidiaContainerToolKitVersion(connection);
    console.log('nvidia-ctk version', version);

    // get the nvidia Container device interface
    return this.getNvidiaCDI(connection);
  }
}
