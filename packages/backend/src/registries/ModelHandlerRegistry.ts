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
import { Publisher } from '../utils/Publisher';
import { Disposable } from '@podman-desktop/api';
import { MSG_MODEL_HANDLERS_UPDATE } from '@shared/Messages';
import type { ModelHandler } from '../models/ModelHandler';
import type { RpcExtension } from '@shared/messages/MessageProxy';

export class ModelHandlerRegistry extends Publisher<string[]> {
  #providers: Map<string, ModelHandler>;
  constructor(rpcExtension: RpcExtension) {
    super(rpcExtension, MSG_MODEL_HANDLERS_UPDATE, () => this.getAll().map(provider => provider.name));
    this.#providers = new Map();
  }

  register(provider: ModelHandler): Disposable {
    this.#providers.set(provider.name, provider);

    this.notify();
    return Disposable.create(() => {
      this.unregister(provider);
    });
  }

  unregister(provider: ModelHandler): void {
    this.#providers.delete(provider.name);
    this.notify();
  }

  getAll(): ModelHandler[] {
    return Array.from(this.#providers.values());
  }

  findModelHandler(url: string): ModelHandler | undefined {
    return Array.from(this.#providers.values()).find(modelHandler => modelHandler.accept(url));
  }
}
