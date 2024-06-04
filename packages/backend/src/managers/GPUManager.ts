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
import { type Disposable, type Webview } from '@podman-desktop/api';
import type { IGPUInfo } from '@shared/src/models/IGPUInfo';
import { Publisher } from '../utils/Publisher';
import { Messages } from '@shared/Messages';
import type { IWorker } from '../workers/IWorker';
import { WinGPUDetector } from '../workers/gpu/WinGPUDetector';
import { platform } from 'node:os';

/**
 * @experimental
 */
export class GPUManager extends Publisher<IGPUInfo[]> implements Disposable {
  #gpus: IGPUInfo[];

  #workers: IWorker<void, IGPUInfo[]>[];

  constructor(webview: Webview) {
    super(webview, Messages.MSG_GPUS_UPDATE, () => this.getAll());
    // init properties
    this.#gpus = [];
    this.#workers = [new WinGPUDetector()];
  }

  dispose(): void {}

  getAll(): IGPUInfo[] {
    return this.#gpus;
  }

  async collectGPUs(): Promise<IGPUInfo[]> {
    const worker = this.#workers.find(worker => worker.enabled());
    if (worker === undefined) throw new Error(`no worker enable to collect GPU on platform ${platform}`);

    this.#gpus = await worker.perform();
    return this.getAll();
  }
}
