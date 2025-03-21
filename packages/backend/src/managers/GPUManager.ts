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
import { type Disposable } from '@podman-desktop/api';
import { GPUVendor, type IGPUInfo } from '@shared/models/IGPUInfo';
import { Publisher } from '../utils/Publisher';
import { graphics } from 'systeminformation';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { MSG_GPUS_UPDATE } from '@shared/Messages';

/**
 * @experimental
 */
export class GPUManager extends Publisher<IGPUInfo[]> implements Disposable {
  #gpus: IGPUInfo[];

  constructor(rpcExtension: RpcExtension) {
    super(rpcExtension, MSG_GPUS_UPDATE, () => this.getAll());
    // init properties
    this.#gpus = [];
  }

  dispose(): void {}

  getAll(): IGPUInfo[] {
    return this.#gpus;
  }

  async collectGPUs(): Promise<IGPUInfo[]> {
    const { controllers } = await graphics();
    return controllers.map(controller => ({
      vendor: this.getVendor(controller.vendor),
      model: controller.model,
      vram: controller.vram ?? undefined,
    }));
  }

  protected getVendor(raw: string): GPUVendor {
    switch (raw) {
      case 'Intel Corporation':
        return GPUVendor.INTEL;
      case 'NVIDIA':
      case 'NVIDIA Corporation':
        return GPUVendor.NVIDIA;
      case 'Apple':
        return GPUVendor.APPLE;
      default:
        return GPUVendor.UNKNOWN;
    }
  }
}
